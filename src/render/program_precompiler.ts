import browser from '../util/browser';

import type Painter from './painter';
import type {CreateProgramParams} from './painter';
import type {ProgramName} from './program';
import type {DynamicDefinesType} from './program/program_uniforms';
import type Style from '../style/style';
import type {TypedStyleLayer} from '../style/style_layer/typed_style_layer';
import type EvaluationParameters from '../style/evaluation_parameters';

// A queued precompile entry is just a `getOrCreateProgram` call captured for later.
// `params` carries all the runtime overrides (`overrideFog`, `overrideTerrain`, etc.)
type PrecompileTask = {
    programId: ProgramName;
    params: CreateProgramParams;
};

const SHADOW_DEFINES: DynamicDefinesType[] = ['RENDER_SHADOWS', 'NORMAL_OFFSET'];

// Programs whose `draw_*.ts` always appends draw-time defines (e.g. `DEPTH_D24`)
// we don't know at precompile time. Their cache keys never match a default-params precompile, so every variant
// we'd emit is wasted. Skip until we have a per-programId variant table for them.
const PRECOMPILE_SKIP: Set<ProgramName> = new Set(['symbol', 'circle']);

export class ProgramPrecompiler {
    // Safety margin (ms) before the idle deadline — we can't preempt mid-compile, so the slice
    // stops once `timeRemaining()` drops to the margin. With KHR, `linkProgram` returns immediately
    // and 5 ms is plenty; without KHR, `_finalize`'s sync `LINK_STATUS` check can take 25 ms+ on slow
    // devices, so a single compile can blow a tight margin.
    static readonly DEADLINE_MARGIN_KHR_MS = 5;
    static readonly DEADLINE_MARGIN_SYNC_MS = 25;

    _queue: PrecompileTask[];
    _needsBuild: boolean;
    _idleHandle: number | null;

    constructor() {
        this._queue = [];
        this._needsBuild = true;
        this._idleHandle = null;
    }

    needsBuild(): boolean {
        return this._needsBuild;
    }

    buildQueue(layers: TypedStyleLayer[], parameters: EvaluationParameters, style: Style) {
        if (this._idleHandle != null && typeof cancelIdleCallback !== 'undefined') {
            cancelIdleCallback(this._idleHandle);
        }
        this._idleHandle = null;
        this._queue = [];
        this._needsBuild = false;

        const hasFog = !!style.fog;
        const hasTerrain = style.hasTerrain();
        const hasGlobe = !!(style.projection && style.projection.name === 'globe');
        const hasTerrainOrGlobe = hasTerrain || hasGlobe;
        const hasShadows = !!(style.directionalLight && style.directionalLight.shadowsEnabled());

        const painter = style.map && style.map.painter;

        // Without KHR_parallel_shader_compile, every queued variant is a sync compile in the idle slice —
        // cartesian + transition-targeted enumeration becomes pure overhead for variants the runtime may never need.
        // The no-KHR path still emits the *guaranteed-needed* programs (per-layer default + RTT, clippingMask,
        // terrainRaster) — these would compile on first interaction anyway, so shifting them to idle is strictly positive.
        const noKHR = !painter || !painter.context.extParallelShaderCompile;

        // `mrt-fallback` mode (style has data-driven emissive AND no WEBGL_blend_func_extended — Firefox + Standard)
        // makes every draping draw call append `USE_MRT1` to defines. Mirror that at precompile time so RTT cache
        // keys actually match what the runtime asks for.
        const mrtFallback = !!painter && painter.emissiveMode === 'mrt-fallback';

        // Each axis defaults to false (matching `currentGlobalDefines` when overrides are absent at runtime). `params` carries
        // layer-derived params (config, lut, layer-default `overrideFog`); special-purpose programs omit it.
        const emit = (programId: ProgramName, defines: DynamicDefinesType[] = [], opts: {params?: CreateProgramParams, fog?: boolean, terrain?: boolean, globe?: boolean, rtt?: boolean} = {}) => {
            this._queue.push({programId, params: {
                ...opts.params,
                defines,
                overrideFog: !!opts.fog,
                overrideTerrain: !!opts.terrain,
                overrideGlobe: !!opts.globe,
                overrideRtt: !!opts.rtt,
                precompiled: true,
            }});
        };

        for (const layer of layers) {
            if (layer.visibility === 'none') continue;
            const programIds = layer.getProgramIds();
            if (!programIds) continue;

            for (const programId of programIds) {
                if (PRECOMPILE_SKIP.has(programId)) continue;

                const params = layer.getDefaultProgramParams(programId, parameters.zoom, style._styleColorTheme.lut);
                if (!params) continue;

                // Each axis is expanded only when the style can activate it AND the shader source references the define
                // (avoids variants that would dedupe to the same cache key). Shadow reception only happens on elevated-road geometry
                // (`layer.hasElevation()`); draped layers go through RTT instead of the TERRAIN code path so we skip TERRAIN there.
                const source = painter ? painter.getShaderSource(programId) : null;
                const axisRtt = hasTerrainOrGlobe && (!source || source.usedDefines.has('RENDER_TO_TEXTURE'));
                const rttDefines = mrtFallback && axisRtt ?
                    (params.defines || []).concat('USE_MRT1' as DynamicDefinesType) :
                    params.defines;

                if (noKHR) {
                    emit(programId, params.defines, {params});
                    if (axisRtt) emit(programId, rttDefines, {params, rtt: true});
                    continue;
                }

                const axisFog = hasFog && (!source || source.usedDefines.has('FOG'));
                const axisTerrain = hasTerrain && !layer.isDraped() && (!source || source.usedDefines.has('TERRAIN'));
                const axisGlobe = hasGlobe && (!source || source.usedDefines.has('GLOBE'));
                const axisShadows = hasShadows && layer.hasElevation() && (!source || source.usedDefines.has('RENDER_SHADOWS'));

                // Cartesian over {shadows, terrain, globe, fog}. RTT is exclusive of all other globals (terrain draping renders
                // without TERRAIN/FOG/SHADOWS/GLOBE). Shadows aren't a global define — the precompiler injects them via params.defines.
                for (const shadows of (axisShadows ? [false, true] : [false])) {
                    const defines = !shadows ? (params.defines || []) : (params.defines || []).concat(SHADOW_DEFINES);
                    for (const terrain of (axisTerrain ? [false, true] : [false])) {
                        for (const globe of (axisGlobe ? [false, true] : [false])) {
                            for (const fog of (axisFog ? [false, true] : [false])) {
                                emit(programId, defines, {params, fog, terrain, globe});
                            }
                        }
                    }
                }
                if (axisRtt) {
                    emit(programId, rttDefines, {params, rtt: true});
                }
            }
        }

        // Always-needed special-purpose programs: clippingMask is used unconditionally; terrainRaster runs every
        // frame when terrain is on. Both have no draw-time-appended defines, so cache keys match cleanly. Worth
        // precompiling on no-KHR too — guaranteed-needed, not transition speculation.
        emit('clippingMask');

        if (hasTerrain) {
            for (const morphing of [false, true]) {
                const defines: DynamicDefinesType[] = morphing ? ['TERRAIN_VERTEX_MORPHING'] : [];
                emit('terrainRaster', defines, {terrain: true, fog: hasFog});
            }
        }

        // Remaining special-purpose programs are either transition-targeted (globe ↔ mercator boundary,
        // shadow-pass ground rendering) or carry draw-time defines we don't anticipate (hillshadePrepare).
        // Their value depends on parallel compile to amortize speculation, so KHR-only.
        if (noKHR) return;

        if (layers.some(l => l.type === 'hillshade')) {
            emit('hillshadePrepare');
        }

        // groundShadow axes (from `shadow_renderer.ts`): {RENDER_CUTOFF} × {NORMAL_OFFSET}.
        if (hasShadows) {
            for (const cutoff of [false, true]) {
                for (const normalOffset of [false, true]) {
                    const defines: DynamicDefinesType[] = [];
                    if (cutoff) defines.push('RENDER_CUTOFF');
                    defines.push('RENDER_SHADOWS');
                    if (normalOffset) defines.push('NORMAL_OFFSET');
                    emit('groundShadow', defines);
                    if (hasFog) emit('groundShadow', defines, {fog: true});
                }
            }
        }

        // Globe is zoom-dependent on globe-capable styles — these are needed when the
        // map crosses the globe→mercator transition.
        if (hasGlobe) {
            // globeRaster: {base, MORPHING, POLES} × {CUSTOM_ANTIALIASING}.
            for (const base of [[], ['TERRAIN_VERTEX_MORPHING'], ['GLOBE_POLES']] as DynamicDefinesType[][]) {
                for (const antialiasing of [false, true]) {
                    const defines: DynamicDefinesType[] = [...base, 'PROJECTION_GLOBE_VIEW'];
                    if (antialiasing) defines.push('CUSTOM_ANTIALIASING');
                    emit('globeRaster', defines, {terrain: hasTerrain, globe: true, fog: hasFog});
                }
            }

            // globeAtmosphere: {mercator-view, globe-view} × {ALPHA_PASS}. Mercator-view runs when a globe-capable style zooms in
            // past the transition (GLOBE absent from globals, but the program is still globeAtmosphere). FOG appears twice
            // in the resulting cache key — matches runtime, which also passes FOG via both `defines` and globals.
            for (const globe of [false, true]) {
                const base: DynamicDefinesType[] = globe ? ['PROJECTION_GLOBE_VIEW', 'FOG'] : ['FOG'];
                emit('globeAtmosphere', base, {fog: true, terrain: hasTerrain, globe});
                emit('globeAtmosphere', [...base, 'ALPHA_PASS'], {fog: true, terrain: hasTerrain, globe});
            }

            emit('stars', [], {fog: hasFog, terrain: hasTerrain, globe: true});
        }
    }

    _executeBatch(deadline: IdleDeadline, painter: Painter, style: Style) {
        // Pause during active camera motion. Even with KHR, each `linkProgram` has main-thread cost
        // (~1–3 ms on mid-range mobile drivers); a slice landing between rAF frames can fit one and
        // push the next frame past vsync. Reschedule and let the queue resume after `moveend`.
        if (style.map && style.map.isMoving()) {
            this._idleHandle = browser.requestIdleCallback((d) => this._executeBatch(d, painter, style));
            return;
        }

        // Finalize any programs whose parallel compile finished since the previous batch.
        painter.context.sweepPendingPrograms();

        const hasKHR = !!painter.context.extParallelShaderCompile;
        const margin = hasKHR ? ProgramPrecompiler.DEADLINE_MARGIN_KHR_MS : ProgramPrecompiler.DEADLINE_MARGIN_SYNC_MS;
        let processed = 0;

        while (this._queue.length > 0) {
            const task = this._queue.shift();
            if (!task) break;
            painter.style = style;
            // `currentGlobalDefines` only adds FOG when both `overrideFog` is true *and*
            // painter's `_fogVisible` is set; mirror the runtime convention here.
            painter._fogVisible = !!task.params.overrideFog;
            painter.getOrCreateProgram(task.programId, task.params);
            processed++;
            if (deadline.timeRemaining() <= margin) break;
        }

        // `gl.flush()` is load-bearing here, not an optimization: `linkProgram` queues work but the driver-side
        // native shader JIT can be deferred until first use. Without flush, all the precompile's queued work hits
        // on the next draw call → giant GPU stall. With flush, the JIT happens during the idle slice. Applies
        // regardless of KHR — on no-KHR `LINK_STATUS` only forces the WebGL/ANGLE-side link, not driver-side
        // native compilation. Skip only when no work was done this slice or the deadline left no headroom (we'd
        // be running flush past the slice budget). See mapbox/mapbox-sdk#12676.
        const hasHeadroom = this._queue.length === 0 || deadline.timeRemaining() > margin;
        if (processed > 0 && hasHeadroom) {
            painter.context.gl.flush();
        }

        // Keep scheduling while either the queue has work or programs are pending finalization.
        // After the queue empties, the last batch's KHR compiles may still be in flight; without
        // continued sweeping they'd sit in `_pendingPrograms` until the next render call, causing
        // a one-time stall on first interaction after a long idle. `maybeFinalize` is gated on
        // `COMPLETION_STATUS_KHR`, so additional slices are cheap if compiles aren't ready yet.
        // No-KHR path: `_pendingPrograms` is always empty (constructor finalizes synchronously),
        // so this reduces to the original `_queue.length > 0` check.
        if (this._queue.length > 0 || painter.context._pendingPrograms.size > 0) {
            this._idleHandle = browser.requestIdleCallback((d) => this._executeBatch(d, painter, style));
        } else {
            this._idleHandle = null;
        }
    }

    processQueue(painter: Painter, style: Style) {
        if (this._queue.length === 0) return;

        if (this._idleHandle != null && typeof cancelIdleCallback !== 'undefined') {
            cancelIdleCallback(this._idleHandle);
        }

        this._idleHandle = browser.requestIdleCallback((d) => this._executeBatch(d, painter, style));
    }

    reset() {
        if (this._idleHandle != null && typeof cancelIdleCallback !== 'undefined') {
            cancelIdleCallback(this._idleHandle);
        }
        this._queue = [];
        this._idleHandle = null;
        this._needsBuild = true;
    }
}
