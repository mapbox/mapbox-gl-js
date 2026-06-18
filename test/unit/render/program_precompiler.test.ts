/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {test, expect, vi, beforeEach, afterEach} from '../../util/vitest';
import {ProgramPrecompiler} from '../../../src/render/program_precompiler';
import browser from '../../../src/util/browser';

function createLayer(overrides = {}) {
    return {
        minzoom: 0,
        maxzoom: 3,
        visibility: 'visible',
        getProgramIds: () => ['fill'],
        getDefaultProgramParams: () => ({config: null, defines: []}),
        isDraped: () => false,
        hasElevation: () => false,
        ...overrides
    };
}

function createStyle(overrides = {}) {
    return {
        stylesheet: {},
        fog: null,
        hasTerrain: () => false,
        getTerrain: () => null,
        _styleColorTheme: {lut: null},
        // buildQueue gates cartesian/special-purpose enumeration on KHR availability via
        // `style.map.painter.context.extParallelShaderCompile`. _executeBatch checks `style.map.isMoving()`
        // to pause precompile during active camera motion. Default mock is KHR-present and not moving;
        // tests override `map` to exercise the no-KHR / moving paths.
        map: {
            painter: {context: {extParallelShaderCompile: {}}, getShaderSource: () => null},
            isMoving: () => false
        },
        ...overrides
    };
}

function createPainter(overrides = {}) {
    const calls = [];
    const flushCalls = {count: 0};
    const sweepCalls = {count: 0};
    return {
        calls,
        flushCalls,
        sweepCalls,
        style: null,
        _fogVisible: false,
        context: {
            gl: {flush: () => { flushCalls.count++; }},
            sweepPendingPrograms: () => { sweepCalls.count++; },
            // Default mock is KHR-present; tests that exercise the no-KHR fallback override this.
            extParallelShaderCompile: {},
            _pendingPrograms: new Set()
        },
        getShaderSource: () => null,
        getOrCreateProgram(name, params) {
            calls.push({
                name,
                overrideFog: params.overrideFog,
                overrideRtt: params.overrideRtt,
                fogVisible: this._fogVisible
            });
        },
        ...overrides
    };
}

// Filter the queue to layer-emitted variants only — buildQueue also emits special-purpose
// programs (clippingMask always; terrainRaster / globeRaster / etc when their axes activate),
// which the layer-cartesian assertions below shouldn't conflate.
const LAYER_PROGRAMS = ['fill', 'line'];
const layerTasks = (pp) => pp._queue.filter(t => LAYER_PROGRAMS.includes(t.programId as string));

// Create a deadline whose `timeRemaining()` returns 0 on its N-th call, so that
// _executeBatch — which checks timeRemaining() after each task — processes exactly N tasks.
// Values while under the cap return well above DEADLINE_MARGIN_KHR_MS so the margin
// doesn't short-circuit the loop.
function createDeadline(maxTasks = Infinity) {
    let calls = 0;
    return {
        didTimeout: false,
        timeRemaining: () => {
            calls++;
            return calls >= maxTasks ? 0 : 50;
        }
    };
}

let idleSpy;
let cancelSpy;

beforeEach(() => {
    idleSpy = vi.spyOn(browser, 'requestIdleCallback');
    cancelSpy = vi.fn();
    // jsdom / browser test env may not ship cancelIdleCallback; define a stub either way.
    window.cancelIdleCallback = cancelSpy;
});

afterEach(() => {
    idleSpy.mockRestore();
    delete window.cancelIdleCallback;
});

test('ProgramPrecompiler constructor sets needsBuild and empty queue', () => {
    const pp = new ProgramPrecompiler();
    expect(pp.needsBuild()).toBe(true);
    expect(pp._queue.length).toBe(0);
    expect(pp._idleHandle).toBe(null);
});

test('buildQueue flips needsBuild to false', () => {
    const pp = new ProgramPrecompiler();
    pp.buildQueue([createLayer()], {zoom: 0}, createStyle());
    expect(pp.needsBuild()).toBe(false);
});

test('buildQueue skips layers with visibility none', () => {
    const pp = new ProgramPrecompiler();
    const layer = createLayer({visibility: 'none'});
    pp.buildQueue([layer], {zoom: 0}, createStyle());
    expect(layerTasks(pp).length).toBe(0);
});

test('buildQueue skips layers whose getProgramIds returns null', () => {
    const pp = new ProgramPrecompiler();
    const layer = createLayer({getProgramIds: () => null});
    pp.buildQueue([layer], {zoom: 0}, createStyle());
    expect(layerTasks(pp).length).toBe(0);
});

test('buildQueue creates one task per (layer, programId) (base variant only)', () => {
    const pp = new ProgramPrecompiler();
    const layer = createLayer({minzoom: 0, maxzoom: 3});
    pp.buildQueue([layer], {zoom: 0}, createStyle());
    // 1 programId × 1 variant (base) = 1 task (zoom-independent: cacheKey doesn't vary with zoom)
    const tasks = layerTasks(pp);
    expect(tasks.length).toBe(1);
    for (const task of tasks) {
        expect(task.params.overrideFog).toBe(false);
        expect(task.params.overrideRtt).toBe(false);
    }
});

test('buildQueue adds fog variant when style.fog is set', () => {
    const pp = new ProgramPrecompiler();
    const layer = createLayer({minzoom: 0, maxzoom: 1});
    pp.buildQueue([layer], {zoom: 0}, createStyle({fog: {}}));
    const tasks = layerTasks(pp);
    expect(tasks.length).toBe(2);
    expect(tasks[0].params.overrideFog).toBe(false);
    expect(tasks[1].params.overrideFog).toBe(true);
});

test('buildQueue adds RTT variant when terrain is set', () => {
    const pp = new ProgramPrecompiler();
    const layer = createLayer({minzoom: 0, maxzoom: 1});
    pp.buildQueue([layer], {zoom: 0}, createStyle({stylesheet: {terrain: {source: 'x'}}, hasTerrain: () => true}));
    // base + terrain-axis variant + RTT exclusive variant
    const tasks = layerTasks(pp);
    expect(tasks.length).toBe(3);
    expect(tasks[0].params.overrideRtt).toBe(false);
    expect(tasks.at(-1).params.overrideRtt).toBe(true);
});

test('buildQueue adds RTT variant when projection is globe', () => {
    const pp = new ProgramPrecompiler();
    const layer = createLayer({minzoom: 0, maxzoom: 1});
    pp.buildQueue([layer], {zoom: 0}, createStyle({projection: {name: 'globe'}}));
    // base + globe-axis variant + RTT exclusive variant
    const tasks = layerTasks(pp);
    expect(tasks.length).toBe(3);
    expect(tasks.at(-1).params.overrideRtt).toBe(true);
});

test('buildQueue creates all three variants when fog and terrain both present', () => {
    const pp = new ProgramPrecompiler();
    const layer = createLayer({minzoom: 0, maxzoom: 1});
    pp.buildQueue(
        [layer],
        {zoom: 0},
        createStyle({fog: {}, stylesheet: {terrain: {source: 'x'}}, hasTerrain: () => true})
    );
    // cartesian {terrain × fog} = 4 + exclusive RTT = 5
    expect(layerTasks(pp).length).toBe(5);
});

test('buildQueue multiplies across multiple programIds', () => {
    const pp = new ProgramPrecompiler();
    const layer = createLayer({
        minzoom: 0,
        maxzoom: 2,
        getProgramIds: () => ['fill', 'line']
    });
    pp.buildQueue([layer], {zoom: 0}, createStyle());
    // 2 programIds × 1 variant = 2 tasks
    expect(layerTasks(pp).length).toBe(2);
});

test('buildQueue without KHR_parallel_shader_compile emits guaranteed-needed variants and skips transition speculation', () => {
    const pp = new ProgramPrecompiler();
    const layer = createLayer({
        getProgramIds: () => ['fill', 'line']
    });
    // Style features that would normally trigger cartesian + transition-targeted enumeration.
    const style = createStyle({
        fog: {},
        hasTerrain: () => true,
        stylesheet: {terrain: {source: 'x'}},
        projection: {name: 'globe'},
        map: {
            painter: {context: {extParallelShaderCompile: null}, getShaderSource: () => null, emissiveMode: 'constant'},
            isMoving: () => false
        }
    });
    pp.buildQueue([layer], {zoom: 0}, style);
    // 2 programIds × (baseline + RTT) = 4 layer variants, plus clippingMask (1) and terrainRaster ×2 = 7 total.
    // No globeRaster / globeAtmosphere / stars / groundShadow / hillshadePrepare (transition-targeted).
    expect(pp._queue.length).toBe(7);
    const programIds = pp._queue.map(t => t.programId).sort();
    expect(programIds).toEqual(['clippingMask', 'fill', 'fill', 'line', 'line', 'terrainRaster', 'terrainRaster']);
    // Without mrt-fallback, RTT variants don't carry USE_MRT1.
    const layerRttTask = pp._queue.find(t => t.programId === 'fill' && t.params.overrideRtt);
    expect(layerRttTask.params.defines).not.toContain('USE_MRT1');
});

test('buildQueue without KHR appends USE_MRT1 to RTT variants in mrt-fallback mode', () => {
    const pp = new ProgramPrecompiler();
    const layer = createLayer({getProgramIds: () => ['fill']});
    const style = createStyle({
        stylesheet: {terrain: {source: 'x'}},
        hasTerrain: () => true,
        map: {
            painter: {context: {extParallelShaderCompile: null}, getShaderSource: () => null, emissiveMode: 'mrt-fallback'},
            isMoving: () => false
        }
    });
    pp.buildQueue([layer], {zoom: 0}, style);
    const layerRttTask = pp._queue.find(t => t.programId === 'fill' && t.params.overrideRtt);
    expect(layerRttTask.params.defines).toContain('USE_MRT1');
    // Baseline (non-RTT) variant still doesn't carry USE_MRT1 — runtime only appends it on draping draws.
    const layerBaseTask = pp._queue.find(t => t.programId === 'fill' && !t.params.overrideRtt);
    expect(layerBaseTask.params.defines).not.toContain('USE_MRT1');
});

test('processQueue with empty queue is a no-op', () => {
    const pp = new ProgramPrecompiler();
    const painter = createPainter();
    pp.processQueue(painter, createStyle());
    expect(idleSpy).not.toHaveBeenCalled();
    expect(painter.calls.length).toBe(0);
});

test('processQueue schedules an idle callback and _executeBatch drains tasks until the deadline expires', () => {
    const pp = new ProgramPrecompiler();
    for (let i = 0; i < 15; i++) {
        pp._queue.push({programId: 'fill', params: {overrideFog: false, overrideRtt: false}});
    }

    let scheduled = null;
    idleSpy.mockImplementation((cb) => { scheduled = cb; return 42; });

    const painter = createPainter();
    const style = createStyle();
    pp.processQueue(painter, style);

    expect(typeof scheduled).toBe('function');
    expect(pp._idleHandle).toBe(42);

    // Deadline that only allows 5 iterations before timeRemaining returns 0.
    idleSpy.mockImplementation((cb) => { scheduled = cb; return 43; });
    scheduled(createDeadline(5));

    expect(painter.calls.length).toBe(5);
    expect(pp._queue.length).toBe(10);
    // Deadline expired mid-drain with tasks still queued — flush should be skipped
    // to avoid extending past the idle budget.
    expect(painter.flushCalls.count).toBe(0);
    expect(pp._idleHandle).toBe(43);
});

test('_executeBatch flushes when the queue drains, regardless of remaining time', () => {
    const pp = new ProgramPrecompiler();
    pp._queue.push({programId: 'fill', params: {overrideFog: false, overrideRtt: false}});

    idleSpy.mockImplementation(() => 1);
    const painter = createPainter();
    // Deadline reports 0 time — but queue drains on the single task, so flush must happen.
    pp._executeBatch({didTimeout: false, timeRemaining: () => 0}, painter, createStyle());

    expect(pp._queue.length).toBe(0);
    expect(painter.flushCalls.count).toBe(1);
});

test('_executeBatch flushes after no-KHR batches too (driver-side native JIT may be deferred until flush)', () => {
    const pp = new ProgramPrecompiler();
    pp._queue.push({programId: 'fill', params: {overrideFog: false, overrideRtt: false}});

    idleSpy.mockImplementation(() => 1);
    const painter = createPainter({
        context: {
            gl: {flush: () => { painter.flushCalls.count++; }},
            sweepPendingPrograms: () => {},
            extParallelShaderCompile: null,
            _pendingPrograms: new Set()
        }
    });
    // Plenty of time, queue drains — flush regardless of KHR availability so deferred GPU work
    // doesn't land on the next draw call.
    pp._executeBatch({didTimeout: false, timeRemaining: () => 50}, painter, createStyle());

    expect(pp._queue.length).toBe(0);
    expect(painter.flushCalls.count).toBe(1);
});

test('_executeBatch uses larger margin without KHR_parallel_shader_compile', () => {
    const pp = new ProgramPrecompiler();
    for (let i = 0; i < 3; i++) {
        pp._queue.push({programId: 'fill', params: {overrideFog: false, overrideRtt: false}});
    }

    idleSpy.mockImplementation(() => 1);
    const painter = createPainter({
        context: {
            gl: {flush: () => { painter.flushCalls.count++; }},
            sweepPendingPrograms: () => {},
            extParallelShaderCompile: null,
            _pendingPrograms: new Set()
        }
    });
    // timeRemaining at the KHR margin (5 ms) is well below the no-KHR margin (25 ms),
    // so the no-KHR path should still break after the first task.
    pp._executeBatch(
        {didTimeout: false, timeRemaining: () => ProgramPrecompiler.DEADLINE_MARGIN_KHR_MS},
        painter,
        createStyle()
    );

    expect(painter.calls.length).toBe(1);
    expect(pp._queue.length).toBe(2);
});

test('_executeBatch pauses while map is moving and reschedules without consuming the queue', () => {
    const pp = new ProgramPrecompiler();
    for (let i = 0; i < 3; i++) {
        pp._queue.push({programId: 'fill', params: {overrideFog: false, overrideRtt: false}});
    }

    idleSpy.mockImplementation(() => 77);
    const painter = createPainter();
    const style = createStyle({
        map: {
            painter: {context: {extParallelShaderCompile: {}}, getShaderSource: () => null},
            isMoving: () => true
        }
    });
    pp._executeBatch({didTimeout: false, timeRemaining: () => 50}, painter, style);

    expect(painter.calls.length).toBe(0);
    expect(pp._queue.length).toBe(3);
    expect(painter.sweepCalls.count).toBe(0);
    expect(painter.flushCalls.count).toBe(0);
    expect(idleSpy).toHaveBeenCalledOnce();
    expect(pp._idleHandle).toBe(77);
});

test('_executeBatch skips flush when deadline is within safety margin and tasks remain', () => {
    const pp = new ProgramPrecompiler();
    for (let i = 0; i < 3; i++) {
        pp._queue.push({programId: 'fill', params: {overrideFog: false, overrideRtt: false}});
    }

    idleSpy.mockImplementation(() => 1);
    const painter = createPainter();
    // timeRemaining at the margin — processes one task, breaks, then skips flush because
    // tasks are still queued and there isn't enough headroom.
    pp._executeBatch(
        {didTimeout: false, timeRemaining: () => ProgramPrecompiler.DEADLINE_MARGIN_KHR_MS},
        painter,
        createStyle()
    );

    expect(painter.calls.length).toBe(1);
    expect(pp._queue.length).toBe(2);
    expect(painter.flushCalls.count).toBe(0);
});

test('_executeBatch breaks when timeRemaining drops into the safety margin', () => {
    const pp = new ProgramPrecompiler();
    for (let i = 0; i < 5; i++) {
        pp._queue.push({programId: 'fill', params: {overrideFog: false, overrideRtt: false}});
    }

    idleSpy.mockImplementation(() => 1);
    const painter = createPainter();
    // timeRemaining reports exactly the safety margin — _executeBatch should stop after one task.
    pp._executeBatch(
        {didTimeout: false, timeRemaining: () => ProgramPrecompiler.DEADLINE_MARGIN_KHR_MS},
        painter,
        createStyle()
    );

    expect(painter.calls.length).toBe(1);
    expect(pp._queue.length).toBe(4);
});

test('_executeBatch always processes at least one task even if deadline reports no time remaining', () => {
    const pp = new ProgramPrecompiler();
    pp._queue.push({programId: 'fill', params: {overrideFog: false, overrideRtt: false}});

    idleSpy.mockImplementation(() => 7);
    const painter = createPainter();
    pp._executeBatch({didTimeout: false, timeRemaining: () => 0}, painter, createStyle());

    expect(painter.calls.length).toBe(1);
    expect(pp._queue.length).toBe(0);
});

test('_executeBatch clears _idleHandle when it drains the queue', () => {
    const pp = new ProgramPrecompiler();
    pp._queue.push({programId: 'fill', params: {overrideFog: false, overrideRtt: false}});
    pp._idleHandle = 123;

    idleSpy.mockImplementation(() => 456);
    const painter = createPainter();
    pp._executeBatch({didTimeout: false, timeRemaining: () => 50}, painter, createStyle());

    expect(pp._queue.length).toBe(0);
    expect(pp._idleHandle).toBe(null);
    expect(idleSpy).not.toHaveBeenCalled();
});

test('_executeBatch keeps rescheduling for sweep while pending programs remain after queue empties', () => {
    const pp = new ProgramPrecompiler();
    pp._queue.push({programId: 'fill', params: {overrideFog: false, overrideRtt: false}});

    // Simulate a not-yet-finalized program from a previous batch's KHR compile.
    const painter = createPainter();
    painter.context._pendingPrograms.add({maybeFinalize: () => {}});

    idleSpy.mockImplementation(() => 99);
    pp._executeBatch({didTimeout: false, timeRemaining: () => 50}, painter, createStyle());

    // Queue drained, but pending is non-empty — should reschedule for a sweep-only slice.
    expect(pp._queue.length).toBe(0);
    expect(pp._idleHandle).toBe(99);
    expect(idleSpy).toHaveBeenCalledOnce();
});

test('_executeBatch sets painter.style, fogVisible, and param overrides per task', () => {
    const pp = new ProgramPrecompiler();
    pp._queue.push({programId: 'fill', params: {overrideFog: true, overrideRtt: false}});
    pp._queue.push({programId: 'line', params: {overrideFog: false, overrideRtt: true}});

    idleSpy.mockImplementation(() => 1);
    const painter = createPainter();
    const style = createStyle();
    pp._executeBatch({didTimeout: false, timeRemaining: () => 50}, painter, style);

    expect(painter.style).toBe(style);
    expect(painter.calls[0]).toEqual({name: 'fill', overrideFog: true, overrideRtt: false, fogVisible: true});
    expect(painter.calls[1]).toEqual({name: 'line', overrideFog: false, overrideRtt: true, fogVisible: false});
});

test('processQueue cancels any pending idle handle before rescheduling', () => {
    const pp = new ProgramPrecompiler();
    pp._queue.push({programId: 'fill', params: {overrideFog: false, overrideRtt: false}});
    pp._idleHandle = 11;

    idleSpy.mockImplementation(() => 22);
    pp.processQueue(createPainter(), createStyle());

    expect(cancelSpy).toHaveBeenCalledWith(11);
    expect(pp._idleHandle).toBe(22);
});

test('reset cancels pending idle handle and restores needsBuild', () => {
    const pp = new ProgramPrecompiler();
    pp.buildQueue([createLayer()], {zoom: 0}, createStyle());
    expect(pp.needsBuild()).toBe(false);

    pp._idleHandle = 7;
    pp.reset();

    expect(cancelSpy).toHaveBeenCalledWith(7);
    expect(pp._idleHandle).toBe(null);
    expect(pp._queue.length).toBe(0);
    expect(pp.needsBuild()).toBe(true);
});

test('buildQueue cancels an in-flight idle handle from a previous run', () => {
    const pp = new ProgramPrecompiler();
    pp._idleHandle = 99;

    pp.buildQueue([createLayer()], {zoom: 0}, createStyle());

    expect(cancelSpy).toHaveBeenCalledWith(99);
    expect(pp._idleHandle).toBe(null);
});
