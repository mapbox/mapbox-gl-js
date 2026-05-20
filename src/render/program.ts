import {
    includeMap,
    FRAGMENT_PRELUDE_BLOCK,
    VERTEX_PRELUDE_BLOCK
} from '../shaders/shaders';
import assert from '../style-spec/util/assert';
import VertexArrayObject from './vertex_array_object';
import {terrainUniforms, globeUniforms} from '../terrain/terrain';
import {fogUniforms} from './fog';
import {cutoffUniforms} from './cutoff';
import {lightsUniforms} from '../../3d-style/render/lights';
import {shadowUniforms} from '../../3d-style/render/shadow_uniforms';
import DepthMode from '../gl/depth_mode';
import StencilMode from '../gl/stencil_mode';
import ColorMode from '../gl/color_mode';
import Color from '../style-spec/util/color';
import {Uniform1i} from './uniform_binding';
import {warnOnce} from '../util/util';
import browser from '../util/browser';

import type ProgramConfiguration from '../data/program_configuration';
import type Context from '../gl/context';
import type {TerrainUniformsType, GlobeUniformsType} from '../terrain/terrain';
import type {FogUniformsType} from './fog';
import type {CutoffUniformsType} from './cutoff';
import type {LightsUniformsType} from '../../3d-style/render/lights';
import type {ShadowUniformsType} from '../../3d-style/render/shadow_uniforms';
import type SegmentVector from '../data/segment';
import type VertexBuffer from '../gl/vertex_buffer';
import type IndexBuffer from '../gl/index_buffer';
import type CullFaceMode from '../gl/cull_face_mode';
import type {UniformBindings, UniformValues, IUniform} from './uniform_binding';
import type {BinderUniform} from '../data/program_configuration';
import type Painter from './painter';
import type {Segment} from "../data/segment";
import type {ProgramUniformsType, DynamicDefinesType} from '../render/program/program_uniforms';
import type {PossiblyEvaluated} from '../style/properties';

export type ProgramName = keyof ProgramUniformsType;

export type DrawMode = WebGL2RenderingContext['POINTS'] | WebGL2RenderingContext['LINES'] | WebGL2RenderingContext['TRIANGLES'] | WebGL2RenderingContext['LINE_STRIP'];

export type ShaderSource = {
    fragmentSource: string;
    vertexSource: string;
    usedDefines: Set<DynamicDefinesType>;
    vertexIncludes: Array<string>;
    fragmentIncludes: Array<string>;
};

const debugWireframe2DLayerProgramNames = [
    'fill', 'fillOutline', 'fillPattern',
    'line', 'linePattern',
    'background', 'backgroundPattern',
    "hillshade",
    "raster"];

const debugWireframe3DLayerProgramNames = [
    "stars",
    "rainParticle",
    "snowParticle",
    "fillExtrusion",  "fillExtrusionGroundEffect",
    "building", "buildingBloom",
    "elevatedStructures",
    "model",
    "symbol"];

type InstancingUniformType = {
    ['u_instanceID']: Uniform1i;
};

const instancingUniforms = (context: Context): InstancingUniformType => ({
    'u_instanceID': new Uniform1i(context)});

class Program<Us extends UniformBindings> {
    program: WebGLProgram;
    attributes: Record<string, number>;
    fixedUniforms: Readonly<Us>;
    // Cache fixedUniforms entries to avoid allocations during draw calls
    fixedUniformsEntries: ReadonlyArray<[string, IUniform<unknown>]>;
    binderUniforms: Array<BinderUniform>;
    failedToCreate: boolean;
    terrainUniforms: TerrainUniformsType | null | undefined;
    fogUniforms: FogUniformsType | null | undefined;
    cutoffUniforms: CutoffUniformsType | null | undefined;
    lightsUniforms: LightsUniformsType | null | undefined;
    globeUniforms: GlobeUniformsType | null | undefined;
    shadowUniforms: ShadowUniformsType | null | undefined;

    name: ProgramName;
    configuration: ProgramConfiguration | null | undefined;
    fixedDefines: ReadonlyArray<DynamicDefinesType>;

    // Manually handle instancing by issuing draw calls and replacing gl_InstanceID with uniform
    forceManualRenderingForInstanceIDShaders: boolean;
    instancingUniforms: InstancingUniformType | null | undefined;

    _pending: boolean;
    _context: Context;
    _fragmentShader: WebGLShader | null;
    _vertexShader: WebGLShader | null;
    _fixedUniformsFn: (arg1: Context) => Us;
    _precompiled: boolean;

    static cacheKey(
        source: ShaderSource,
        name: string,
        defines: DynamicDefinesType[],
        programConfiguration?: ProgramConfiguration | null,
    ): string {
        const parts: string[] = [name];

        if (programConfiguration) {
            parts.push(programConfiguration.cacheKey);
        }

        for (const define of defines) {
            // Include known defines that are used, or all custom string defines (like MAX_SYMBOL_FEATURES)
            if (typeof define === 'string' && define.includes(' ')) {
                // Custom numeric define (e.g., "MAX_SYMBOL_FEATURES 128")
                parts.push(define);
            } else if (source.usedDefines.has(define)) {
                parts.push(define);
            }
        }

        return parts.join('/');
    }

    constructor(
        context: Context,
        name: ProgramName,
        source: ShaderSource,
        configuration: ProgramConfiguration | null | undefined,
        fixedUniforms: (arg1: Context) => Us,
        fixedDefines: DynamicDefinesType[],
        precompiled: boolean = false
    ) {
        const gl = context.gl;
        this.program = gl.createProgram();

        this._context = context;
        this._fixedUniformsFn = fixedUniforms;
        this._pending = true;
        this._precompiled = precompiled;
        this.attributes = {};

        this.configuration = configuration;
        this.name = name;
        this.fixedDefines = [...fixedDefines];

        if (precompiled) context._compileStats.precompiled++;
        else context._compileStats.onDemand++;

        const configDefines = configuration ? configuration.defines() : [];
        const defines = configDefines.concat(fixedDefines.map((define) => `#define ${define}`)).join('\n');
        const definesBlock = `#version 300 es\n${defines}`;

        const fragmentParts = [definesBlock, FRAGMENT_PRELUDE_BLOCK];
        for (const include of source.fragmentIncludes) {
            fragmentParts.push(includeMap[include]);
        }

        fragmentParts.push(source.fragmentSource);
        const fragmentSource = fragmentParts.join('\n');

        const vertexParts = [definesBlock, VERTEX_PRELUDE_BLOCK];
        for (const include of source.vertexIncludes) {
            vertexParts.push(includeMap[include]);
        }

        this.forceManualRenderingForInstanceIDShaders = context.forceManualRenderingForInstanceIDShaders && source.vertexSource.includes('gl_InstanceID');

        if (this.forceManualRenderingForInstanceIDShaders) {
            vertexParts.push('uniform int u_instanceID;');
        }

        vertexParts.push(source.vertexSource);
        let vertexSource = vertexParts.join('\n');

        if (this.forceManualRenderingForInstanceIDShaders) {
            vertexSource = vertexSource.replaceAll('gl_InstanceID', 'u_instanceID');
        }

        const fragmentShader = (gl.createShader(gl.FRAGMENT_SHADER));
        if (gl.isContextLost()) {
            this.failedToCreate = true;
            this._pending = false;
            return;
        }
        gl.shaderSource(fragmentShader, fragmentSource);
        gl.compileShader(fragmentShader);
        gl.attachShader(this.program, fragmentShader);

        const vertexShader = (gl.createShader(gl.VERTEX_SHADER));
        if (gl.isContextLost()) {
            this.failedToCreate = true;
            this._pending = false;
            return;
        }
        gl.shaderSource(vertexShader, vertexSource);
        gl.compileShader(vertexShader);
        gl.attachShader(this.program, vertexShader);

        gl.linkProgram(this.program);

        this._fragmentShader = fragmentShader;
        this._vertexShader = vertexShader;

        // When KHR_parallel_shader_compile isn't available, all sync paths
        // (getShaderParameter / getProgramParameter) would stall anyway — just finalize now.
        if (!context.extParallelShaderCompile) {
            this._finalize();
        } else {
            context._pendingPrograms.add(this);
        }
    }

    _finalize() {
        if (!this._pending) return;
        this._pending = false;

        const context = this._context;
        const gl = context.gl;
        context._pendingPrograms.delete(this);

        // Only LINK_STATUS is checked — it blocks until both compiles + link are done.
        // COMPILE_STATUS would be a redundant blocking call (info logs are non-blocking).
        // Time *only* this call: it isolates GPU compile-completion wait from JS/GL bookkeeping
        // (deleteShader, getUniformLocation, etc.) so the metric is comparable across KHR/no-KHR.
        const t0 = browser.now();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const linkOk = gl.getProgramParameter(this.program, gl.LINK_STATUS);
        const ms = browser.now() - t0;

        const stats = context._compileStats;
        stats.totalStallMs += ms;
        if (ms > stats.maxStallMs) stats.maxStallMs = ms;

        if (ms > 1) { // only collect meaningful stalls
            stats.framesMissed += Math.floor(ms * 60 / 1000);
            const defines = this.fixedDefines.join(',');
            stats.stalls.push({name: `${this.name}${defines ? '/' : ''}${defines}`, ms, timestamp: t0});
        }

        if (this._fragmentShader) {
            if (!linkOk) warnOnce(`Fragment shader '${this.name}': ${gl.getShaderInfoLog(this._fragmentShader)}`);
            gl.deleteShader(this._fragmentShader);
            this._fragmentShader = null;
        }
        if (this._vertexShader) {
            if (!linkOk) warnOnce(`Vertex shader '${this.name}': ${gl.getShaderInfoLog(this._vertexShader)}`);
            gl.deleteShader(this._vertexShader);
            this._vertexShader = null;
        }

        if (!linkOk) {
            warnOnce(`Failed to link program '${this.name}': ${gl.getProgramInfoLog(this.program)}`);
            this.failedToCreate = true;
            return;
        }

        this.fixedUniforms = this._fixedUniformsFn(context);
        this.fixedUniformsEntries = Object.entries(this.fixedUniforms);
        this.binderUniforms = this.configuration ? this.configuration.getUniforms(context) : [];

        if (this.forceManualRenderingForInstanceIDShaders) {
            this.instancingUniforms = instancingUniforms(context);
        }

        const fixedDefines = this.fixedDefines;
        const name = this.name;
        // Symbol and circle layer are depth (terrain + 3d layers) occluded
        // For the sake of native compatibility depth occlusion goes via terrain uniforms block
        if (fixedDefines.includes('TERRAIN') || fixedDefines.includes('ELEVATED') || name.includes('symbol') || name.includes('circle')) {
            this.terrainUniforms = terrainUniforms(context);
        }
        if (fixedDefines.includes('GLOBE')) {
            this.globeUniforms = globeUniforms(context);
        }
        if (fixedDefines.includes('FOG')) {
            this.fogUniforms = fogUniforms(context);
        }
        if (fixedDefines.includes('RENDER_CUTOFF')) {
            this.cutoffUniforms = cutoffUniforms(context);
        }
        if (fixedDefines.includes('LIGHTING_3D_MODE')) {
            this.lightsUniforms = lightsUniforms(context);
        }
        if (fixedDefines.includes('RENDER_SHADOWS')) {
            this.shadowUniforms = shadowUniforms(context);
        }
    }

    // Opportunistic finalize from idle sweep. Uses the non-blocking COMPLETION_STATUS_KHR poll —
    // skips finalize when the driver hasn't finished, leaving the program for a later sweep.
    maybeFinalize() {
        if (!this._pending) return;
        const ext = this._context.extParallelShaderCompile;
        if (ext && !this._context.gl.getProgramParameter(this.program, ext.COMPLETION_STATUS_KHR)) return;
        this._finalize();
    }

    _ensureReady() {
        if (!this._pending) return;
        this._finalize();

        // Sibling sweep AFTER our stall — driver threads may have finished others during our LINK_STATUS wait.
        // Non-blocking completion polls finalize ready ones now so their future draw-path use doesn't stall.
        this._context.sweepPendingPrograms();
    }

    getAttributeLocation(gl: WebGL2RenderingContext, name: string): number {
        this._ensureReady();
        let location = this.attributes[name];
        if (location === undefined) {
            location = this.attributes[name] = gl.getAttribLocation(this.program, name);
        }
        return location;
    }

    setTerrainUniformValues(context: Context, terrainUniformValues: UniformValues<TerrainUniformsType>) {
        this._ensureReady();
        if (!this.terrainUniforms) return;
        const uniforms: TerrainUniformsType = this.terrainUniforms;

        if (this.failedToCreate) return;
        context.program.set(this.program);

        for (const name in terrainUniformValues) {
            if (uniforms[name]) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                uniforms[name].set(this.program, name, terrainUniformValues[name]);
            }
        }
    }

    setGlobeUniformValues(context: Context, globeUniformValues: UniformValues<GlobeUniformsType>) {
        this._ensureReady();
        if (!this.globeUniforms) return;
        const uniforms: GlobeUniformsType = this.globeUniforms;

        if (this.failedToCreate) return;
        context.program.set(this.program);

        for (const name in globeUniformValues) {
            if (uniforms[name]) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                uniforms[name].set(this.program, name, globeUniformValues[name]);
            }
        }
    }

    setFogUniformValues(context: Context, fogUniformValues: UniformValues<FogUniformsType>) {
        this._ensureReady();
        if (!this.fogUniforms) return;
        const uniforms: FogUniformsType = this.fogUniforms;

        if (this.failedToCreate) return;
        context.program.set(this.program);

        for (const name in fogUniformValues) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            uniforms[name].set(this.program, name, fogUniformValues[name]);
        }
    }

    setCutoffUniformValues(context: Context, cutoffUniformValues: UniformValues<CutoffUniformsType>) {
        this._ensureReady();
        if (!this.cutoffUniforms) return;
        const uniforms: CutoffUniformsType = this.cutoffUniforms;

        if (this.failedToCreate) return;
        context.program.set(this.program);

        for (const name in cutoffUniformValues) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            uniforms[name].set(this.program, name, cutoffUniformValues[name]);
        }
    }

    setLightsUniformValues(context: Context, lightsUniformValues: UniformValues<LightsUniformsType>) {
        this._ensureReady();
        if (!this.lightsUniforms) return;
        const uniforms: LightsUniformsType = this.lightsUniforms;

        if (this.failedToCreate) return;
        context.program.set(this.program);

        for (const name in lightsUniformValues) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            uniforms[name].set(this.program, name, lightsUniformValues[name]);
        }
    }

    setShadowUniformValues(context: Context, shadowUniformValues: UniformValues<ShadowUniformsType>) {
        this._ensureReady();
        if (this.failedToCreate || !this.shadowUniforms) return;

        const uniforms: ShadowUniformsType = this.shadowUniforms;
        context.program.set(this.program);

        for (const name in shadowUniformValues) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            uniforms[name].set(this.program, name, shadowUniformValues[name]);
        }
    }

    _drawDebugWireframe(painter: Painter, depthMode: Readonly<DepthMode>,
        stencilMode: Readonly<StencilMode>,
        colorMode: Readonly<ColorMode>,
        indexBuffer: IndexBuffer, segment: Segment,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        currentProperties: PossiblyEvaluated<any>,
        zoom?: number,
        configuration?: ProgramConfiguration,
        instanceCount?: number
    ) {

        const wireframe = painter.options.wireframe;

        if (wireframe.terrain === false && wireframe.layers2D === false && wireframe.layers3D === false) {
            return;
        }

        const context = painter.context;

        const subjectForWireframe = (() => {
            // Terrain
            if (wireframe.terrain && (this.name === 'terrainRaster' || this.name === 'globeRaster')) {
                return true;
            }

            const drapingInProgress = painter._terrain && painter._terrain.renderingToTexture;

            // 2D
            if (wireframe.layers2D && !drapingInProgress) {
                if (debugWireframe2DLayerProgramNames.includes(this.name)) {
                    return true;
                }
            }

            // 3D
            if (wireframe.layers3D) {
                if (debugWireframe3DLayerProgramNames.includes(this.name)) {
                    return true;
                }
            }

            return false;
        })();

        if (!subjectForWireframe) {
            return;
        }

        const gl = context.gl;
        const linesIndexBuffer = painter.wireframeDebugCache.getLinesFromTrianglesBuffer(painter.frameCounter, indexBuffer, context);

        if (!linesIndexBuffer) {
            return;
        }

        const debugDefines: DynamicDefinesType[] = [...this.fixedDefines, 'DEBUG_WIREFRAME'];
        const debugProgram = painter.getOrCreateProgram(this.name, {config: this.configuration, defines: debugDefines});
        debugProgram._ensureReady();

        context.program.set(debugProgram.program);

        const copyUniformValues = (group: string, pSrc: Program<Us>, pDst: Program<UniformBindings>) => {
            if (pSrc[group] && pDst[group]) {
                for (const name in pSrc[group]) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    if (pDst[group][name]) {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                        pDst[group][name].set(pDst.program, name, pSrc[group][name].current);
                    }
                }
            }
        };

        if (configuration) {
            configuration.setUniforms(debugProgram.program, context, debugProgram.binderUniforms, currentProperties, {zoom});
        }

        copyUniformValues("fixedUniforms", this, debugProgram);
        copyUniformValues("terrainUniforms", this, debugProgram);
        copyUniformValues("globeUniforms", this, debugProgram);
        copyUniformValues("fogUniforms", this, debugProgram);
        copyUniformValues("lightsUniforms", this, debugProgram);
        copyUniformValues("shadowUniforms", this, debugProgram);

        linesIndexBuffer.bind();

        // Debug wireframe uses premultiplied alpha blending (alpha channel is left unchanged)
        context.setColorMode(new ColorMode([gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE],
            Color.transparent, [true, true, true, false]));
        context.setDepthMode(new DepthMode(depthMode.func === gl.LESS ? gl.LEQUAL : depthMode.func, DepthMode.ReadOnly, depthMode.range));
        context.setStencilMode(StencilMode.disabled);

        const count = segment.primitiveLength * 3 * 2; // One triangle corresponds to 3 lines (each has 2 indices)
        const offset = segment.primitiveOffset * 3 * 2 * 2; // One triangles corresponds to 3 lines (2 indices * 2 bytes per index)

        if (this.forceManualRenderingForInstanceIDShaders) {
            const renderInstanceCount = instanceCount ? instanceCount : 1;
            for (let i = 0; i < renderInstanceCount; ++i) {
                debugProgram.instancingUniforms["u_instanceID"].set(this.program, "u_instanceID", i);

                gl.drawElements(
                    gl.LINES,
                    count,
                    gl.UNSIGNED_SHORT,
                    offset
                );
            }
        } else {
            if (instanceCount && instanceCount > 1) {
                gl.drawElementsInstanced(
                    gl.LINES,
                    count,
                    gl.UNSIGNED_SHORT,
                    offset,
                    instanceCount);
            } else {
                gl.drawElements(
                    gl.LINES,
                    count,
                    gl.UNSIGNED_SHORT,
                    offset
                );
            }
        }

        // Revert to non-wireframe parameters
        indexBuffer.bind();
        context.program.set(this.program);
        context.setDepthMode(depthMode);
        context.setStencilMode(stencilMode);
        context.setColorMode(colorMode);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    checkUniforms(name: string, define: DynamicDefinesType, uniforms: any) {
        if (this.fixedDefines.includes(define)) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            for (const key of Object.keys(uniforms)) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                if (!uniforms[key].initialized) {
                    throw new Error(`Program '${this.name}', from draw '${name}': uniform ${key} not set but required by ${define} being defined`);
                }
            }
        }
    }

    draw<Us>(
        painter: Painter,
        drawMode: DrawMode,
        depthMode: Readonly<DepthMode>,
        stencilMode: Readonly<StencilMode>,
        colorMode: Readonly<ColorMode>,
        cullFaceMode: Readonly<CullFaceMode>,
        uniformValues: UniformValues<Us>,
        layerID: string,
        layoutVertexBuffer: VertexBuffer,
        indexBuffer: IndexBuffer | undefined,
        segments: SegmentVector,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        currentProperties?: PossiblyEvaluated<any>,
        zoom?: number,
        configuration?: ProgramConfiguration,
        dynamicLayoutBuffers?: Array<VertexBuffer | null | undefined>,
        instanceCount?: number
    ) {
        const context = painter.context;
        const gl = context.gl;

        this._ensureReady();
        if (this.failedToCreate) return;

        context.program.set(this.program);
        context.setDepthMode(depthMode);
        context.setStencilMode(stencilMode);
        context.setColorMode(colorMode);
        context.setCullFace(cullFaceMode);

        for (const [name, uniform] of this.fixedUniformsEntries) {
            uniform.set(this.program, name, uniformValues[name]);
        }

        if (configuration) {
            configuration.setUniforms(this.program, context, this.binderUniforms, currentProperties, {zoom});
        }

        const primitiveSize = {
            [gl.POINTS]: 1,
            [gl.LINES]: 2,
            [gl.TRIANGLES]: 3,
            [gl.LINE_STRIP]: 1
        }[drawMode];

        this.checkUniforms(layerID, 'RENDER_SHADOWS', this.shadowUniforms);

        const dynamicBuffers = dynamicLayoutBuffers || [];
        const paintVertexBuffers = configuration ? configuration.getPaintVertexBuffers() : [];
        const shouldDrawWireframe = drawMode === gl.TRIANGLES && indexBuffer;

        const vertexAttribDivisorValue = instanceCount && instanceCount > 0 ? 1 : undefined;
        for (const segment of segments.get()) {
            const vaos = segment.vaos || (segment.vaos = {});
            const vao: VertexArrayObject = vaos[layerID] || (vaos[layerID] = new VertexArrayObject());
            vao.bind(
                context,
                this,
                layoutVertexBuffer,
                paintVertexBuffers,
                indexBuffer,
                segment.vertexOffset,
                dynamicBuffers,
                vertexAttribDivisorValue
            );

            if (this.forceManualRenderingForInstanceIDShaders) {
                const renderInstanceCount = instanceCount ? instanceCount : 1;

                for (let i = 0; i < renderInstanceCount; ++i) {
                    this.instancingUniforms["u_instanceID"].set(this.program, "u_instanceID", i);

                    if (indexBuffer) {
                        gl.drawElements(
                            drawMode,
                            segment.primitiveLength * primitiveSize,
                            gl.UNSIGNED_SHORT,
                            segment.primitiveOffset * primitiveSize * 2);
                    } else {
                        gl.drawArrays(drawMode, segment.vertexOffset, segment.vertexLength);
                    }
                }
            } else {
                if (instanceCount && instanceCount > 1) {
                    assert(indexBuffer);
                    gl.drawElementsInstanced(
                        drawMode,
                        segment.primitiveLength * primitiveSize,
                        gl.UNSIGNED_SHORT,
                        segment.primitiveOffset * primitiveSize * 2,
                        instanceCount);
                } else if (indexBuffer) {
                    gl.drawElements(
                        drawMode,
                        segment.primitiveLength * primitiveSize,
                        gl.UNSIGNED_SHORT,
                        segment.primitiveOffset * primitiveSize * 2);
                } else {
                    gl.drawArrays(drawMode, segment.vertexOffset, segment.vertexLength);
                }
            }
            if (shouldDrawWireframe) {
                this._drawDebugWireframe(painter, depthMode, stencilMode, colorMode, indexBuffer, segment,
                    currentProperties, zoom, configuration, instanceCount);
            }
        }
    }
}

export default Program;
