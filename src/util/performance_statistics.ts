/**
 * A sampler that adds a set of values to {@link PerformanceStatistics}.
 *
 * - `'cumulative'` adds `cumulativeStatistics`: draw call, program and framebuffer counters.
 * - `'per-frame'` adds `perFrameStatistics`: render pass and layer timings.
 */
export type PerformanceSampler = 'cumulative' | 'per-frame';

/**
 * Options for {@link Map#startPerformanceStatisticsCollection}.
 *
 * @property {Array<PerformanceSampler>} samplers The optional samplers to enable.
 * @property {number} samplingDurationMillis The minimum duration of one sampling window, in whole milliseconds.
 * A window closes at the end of the first frame rendered after this duration. `0` closes a window every frame.
 */
export type PerformanceStatisticsOptions = {
    samplers: Array<PerformanceSampler>;
    samplingDurationMillis: number;
};

/**
 * The largest and the median of the durations measured in one sampling window.
 */
export type DurationStatistics = {
    maxMillis: number;
    medianMillis: number;
};

/**
 * The duration of one render pass or layer.
 *
 * @property {string} name The render pass name or the layer id.
 * @property {number} durationMillis The longest duration in one frame of the sampling window.
 */
export type GroupPerformanceStatistics = {
    name: string;
    durationMillis: number;
};

/**
 * Rendering counters, collected by the `'cumulative'` sampler.
 *
 * @property {number} drawCalls The number of WebGL draw calls in the last frame of the sampling window.
 * An instanced draw call counts as one. Draw calls of custom layers are not counted.
 * @property {number} graphicsPrograms The number of shader programs created by the map.
 * @property {number} graphicsProgramsCreationTimeMillis The time spent to create shader programs since collection started.
 * @property {number} fboSwitchCount The number of framebuffer binds since collection started.
 * Only binds made through the map's framebuffer state are counted.
 */
export type CumulativeRenderingStatistics = {
    drawCalls: number;
    graphicsPrograms: number;
    graphicsProgramsCreationTimeMillis: number;
    fboSwitchCount: number;
};

/**
 * Render pass and layer timings on the CPU timeline, collected by the `'per-frame'` sampler.
 *
 * @property {Array<GroupPerformanceStatistics>} topRenderGroups The 10 slowest render passes and layers, slowest first.
 * The render passes are `'upload'`, `'shadowmap'`, `'opaque'` and `'translucent'`. A layer that renders to a texture
 * before these passes is not in a render pass.
 * @property {Array<GroupPerformanceStatistics>} topRenderLayers The 10 slowest layers, slowest first.
 * @property {DurationStatistics} shadowMapDurationStatistics The duration of the shadow map pass.
 * @property {DurationStatistics} uploadDurationStatistics The duration of the pass that prepares the tiles of each source for rendering,
 * which includes the upload of tile data to the GPU.
 */
export type PerFrameRenderingStatistics = {
    topRenderGroups: Array<GroupPerformanceStatistics>;
    topRenderLayers: Array<GroupPerformanceStatistics>;
    shadowMapDurationStatistics: DurationStatistics;
    uploadDurationStatistics: DurationStatistics;
};

/**
 * The performance statistics of one sampling window.
 *
 * @property {number} collectionDurationMillis The real duration of the sampling window.
 * @property {DurationStatistics} mapRenderDurationStatistics The CPU duration of the map render call.
 * @property {CumulativeRenderingStatistics} [cumulativeStatistics] Present when the `'cumulative'` sampler is enabled.
 * @property {PerFrameRenderingStatistics} [perFrameStatistics] Present when the `'per-frame'` sampler is enabled.
 */
export type PerformanceStatistics = {
    collectionDurationMillis: number;
    mapRenderDurationStatistics: DurationStatistics;
    cumulativeStatistics?: CumulativeRenderingStatistics;
    perFrameStatistics?: PerFrameRenderingStatistics;
};

export type RenderPassGroup = 'upload' | 'shadowmap' | 'opaque' | 'translucent';

const TOP_COUNT = 10;

function durationStatistics(durations: Array<number>): DurationStatistics {
    durations.sort((a, b) => a - b);
    const mid = durations.length >> 1;
    const median = durations.length % 2 ? durations[mid]! : (durations[mid - 1]! + durations[mid]!) / 2;
    return {maxMillis: durations.at(-1)!, medianMillis: median};
}

/**
 * Collects render statistics over sampling windows, with the same semantics as the native Maps SDKs.
 * The map creates it only while collection runs, so the render loop does no extra work otherwise.
 * It lives in the lazy-loaded Debug module; `Map#startPerformanceStatisticsCollection` validates the options.
 * Times come from `performance.now()`: `PerformanceUtils` calls are stripped from production builds,
 * and `browser.now()` can be frozen with `setNow`.
 *
 * @private
 */
export class PerformanceStatisticsCollector {
    drawCalls: number;
    graphicsPrograms: number;
    graphicsProgramsCreationTimeMillis: number;
    fboSwitchCount: number;

    _callback: ((statistics: PerformanceStatistics) => void) | null;
    _cumulative: boolean;
    _perFrame: boolean;
    _samplingDuration: number;
    _windowStart: number;
    _frameStart: number;
    // Durations by render pass or layer name: in the current frame (zeroed rather than cleared each frame to
    // avoid allocations), and the largest frame duration in the sampling window. Per-frame loops use forEach
    // because for...of over Map entries allocates an array per entry.
    _frameGroups: Map<string, number>;
    _frameLayers: Map<string, number>;
    _maxGroups!: Map<string, number>;
    _maxLayers!: Map<string, number>;
    _frameDurations!: Array<number>;
    _shadowMapDurations!: Array<number>;
    _uploadDurations!: Array<number>;

    constructor(options: PerformanceStatisticsOptions, programCount: number, callback: (statistics: PerformanceStatistics) => void) {
        const {samplers, samplingDurationMillis} = options;
        this._callback = callback;
        this._cumulative = samplers.includes('cumulative');
        this._perFrame = samplers.includes('per-frame');
        this._samplingDuration = Math.trunc(samplingDurationMillis);
        this._windowStart = performance.now();
        this._frameStart = -1;
        this._frameGroups = new Map();
        this._frameLayers = new Map();
        this._resetWindow();
        this.drawCalls = 0;
        this.graphicsPrograms = programCount;
        this.graphicsProgramsCreationTimeMillis = 0;
        this.fboSwitchCount = 0;
    }

    /**
     * Stops the delivery of statistics, also of a window that closed but is not delivered yet.
     */
    stop() {
        this._callback = null;
    }

    beginFrame() {
        this._frameStart = performance.now();
        this.drawCalls = 0;
        this._frameGroups.forEach(zero);
        this._frameLayers.forEach(zero);
    }

    recordGroup(name: RenderPassGroup, startTime: number) {
        if (this._perFrame && this._frameStart >= 0) addDuration(this._frameGroups, name, startTime);
    }

    recordLayer(id: string, startTime: number) {
        if (this._perFrame && this._frameStart >= 0) addDuration(this._frameLayers, id, startTime);
    }

    recordProgramCreation(startTime: number) {
        this.graphicsPrograms++;
        this.graphicsProgramsCreationTimeMillis += performance.now() - startTime;
    }

    /**
     * Ends the current frame. When the sampling window closes, starts a new window and calls the callback
     * with the statistics of the closed window in a microtask. The microtask keeps a callback error
     * out of the render loop.
     */
    endFrame() {
        // A collection that starts during a frame begins with the next frame.
        if (this._frameStart < 0) return;
        const now = performance.now();
        this._frameDurations.push(now - this._frameStart);
        this._frameStart = -1;
        if (this._perFrame) {
            keepMax(this._frameGroups, this._maxGroups);
            keepMax(this._frameLayers, this._maxLayers);
            this._shadowMapDurations.push(this._frameGroups.get('shadowmap') || 0);
            this._uploadDurations.push(this._frameGroups.get('upload') || 0);
        }

        const elapsed = now - this._windowStart;
        if (elapsed < this._samplingDuration) return;

        const statistics: PerformanceStatistics = {
            collectionDurationMillis: elapsed,
            mapRenderDurationStatistics: durationStatistics(this._frameDurations)
        };
        if (this._cumulative) {
            statistics.cumulativeStatistics = {
                drawCalls: this.drawCalls,
                graphicsPrograms: this.graphicsPrograms,
                graphicsProgramsCreationTimeMillis: this.graphicsProgramsCreationTimeMillis,
                fboSwitchCount: this.fboSwitchCount
            };
        }
        if (this._perFrame) {
            // Like the native collector, a render pass and a layer with the same name are one render group.
            const groups = new Map(this._maxLayers);
            keepMax(this._maxGroups, groups);
            statistics.perFrameStatistics = {
                topRenderGroups: top(groups),
                topRenderLayers: top(this._maxLayers),
                shadowMapDurationStatistics: durationStatistics(this._shadowMapDurations),
                uploadDurationStatistics: durationStatistics(this._uploadDurations)
            };
        }

        this._windowStart = now;
        this._resetWindow();
        queueMicrotask(() => {
            if (this._callback) this._callback(statistics);
        });
    }

    _resetWindow() {
        this._maxGroups = new Map();
        this._maxLayers = new Map();
        this._frameDurations = [];
        this._shadowMapDurations = [];
        this._uploadDurations = [];
    }
}

function addDuration(durations: Map<string, number>, name: string, startTime: number) {
    durations.set(name, (durations.get(name) || 0) + performance.now() - startTime);
}

function zero(_: number, name: string, durations: Map<string, number>) {
    durations.set(name, 0);
}

function keepMax(source: Map<string, number>, target: Map<string, number>) {
    source.forEach((duration, name) => {
        if (duration > (target.get(name) || 0)) target.set(name, duration);
    });
}

// The TOP_COUNT longest durations, slowest first.
function top(durations: Map<string, number>): Array<GroupPerformanceStatistics> {
    return Array.from(durations, ([name, durationMillis]) => ({name, durationMillis}))
        .sort((a, b) => b.durationMillis - a.durationMillis)
        .slice(0, TOP_COUNT);
}
