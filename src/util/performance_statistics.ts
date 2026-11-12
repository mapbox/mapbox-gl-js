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

const SAMPLERS: Array<PerformanceSampler> = ['cumulative', 'per-frame'];
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
 * Times come from `performance.now()`: `PerformanceUtils` calls are stripped from production builds,
 * and `browser.now()` can be frozen with `setNow`.
 *
 * Like the native collector, it gives each group and layer name an index, and keeps durations in arrays
 * by index. This prevents allocations in each frame.
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
    _frameDurations!: Array<number>;
    _nameIndices: Map<string, number>;
    _names: Array<string>;
    // Render durations, indexed by name index. The frame arrays hold the current frame;
    // the max arrays hold the largest frame duration in the sampling window.
    _frameGroups: Array<number>;
    _frameLayers: Array<number>;
    _maxGroups!: Array<number>;
    _maxLayers!: Array<number>;
    _shadowMapDurations!: Array<number>;
    _uploadDurations!: Array<number>;

    constructor(options: PerformanceStatisticsOptions, programCount: number, callback: (statistics: PerformanceStatistics) => void) {
        const {samplers, samplingDurationMillis} = options;
        if (!Array.isArray(samplers) || !samplers.every(sampler => SAMPLERS.includes(sampler))) {
            throw new Error(`samplers must be an array of ${SAMPLERS.map(sampler => `'${sampler}'`).join(', ')}.`);
        }
        if (!(samplingDurationMillis >= 0)) {
            throw new Error(`samplingDurationMillis must be zero or positive, got ${samplingDurationMillis}.`);
        }
        this._callback = callback;
        this._cumulative = samplers.includes('cumulative');
        this._perFrame = samplers.includes('per-frame');
        this._samplingDuration = Math.trunc(samplingDurationMillis);
        this._windowStart = performance.now();
        this._frameStart = -1;
        this._nameIndices = new Map();
        this._names = [];
        this._frameGroups = [];
        this._frameLayers = [];
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
        this._frameGroups.fill(0);
        this._frameLayers.fill(0);
    }

    recordGroup(name: RenderPassGroup, startTime: number) {
        if (this._perFrame && this._frameStart >= 0) this._addDuration(this._frameGroups, name, startTime);
    }

    recordLayer(id: string, startTime: number) {
        if (this._perFrame && this._frameStart >= 0) this._addDuration(this._frameLayers, id, startTime);
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
        if (this._perFrame) this._endFrameDurations();

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
            const maxGroups = this._maxGroups.map((duration, i) => Math.max(duration, this._maxLayers[i] || 0));
            statistics.perFrameStatistics = {
                topRenderGroups: this._top(maxGroups.concat(this._maxLayers.slice(maxGroups.length))),
                topRenderLayers: this._top(this._maxLayers),
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
        this._frameDurations = [];
        this._maxGroups = [];
        this._maxLayers = [];
        this._shadowMapDurations = [];
        this._uploadDurations = [];
    }

    /**
     * Adds the time since `startTime` to the duration of `name` in the current frame.
     * A name can occur more than once in a frame.
     */
    _addDuration(durations: Array<number>, name: string, startTime: number) {
        let index = this._nameIndices.get(name);
        if (index === undefined) {
            index = this._names.push(name) - 1;
            this._nameIndices.set(name, index);
        }
        durations[index] = (durations[index] || 0) + performance.now() - startTime;
    }

    _endFrameDurations() {
        const groups = this._frameGroups;
        const layers = this._frameLayers;
        for (let i = 0; i < groups.length; i++) this._maxGroups[i] = Math.max(this._maxGroups[i] || 0, groups[i] || 0);
        for (let i = 0; i < layers.length; i++) this._maxLayers[i] = Math.max(this._maxLayers[i] || 0, layers[i] || 0);
        this._shadowMapDurations.push(this._frameDuration('shadowmap'));
        this._uploadDurations.push(this._frameDuration('upload'));
    }

    /**
     * Returns the duration of `name` in the current frame. Like the native collector, adds the group
     * and the layer durations of the name.
     */
    _frameDuration(name: string): number {
        const index = this._nameIndices.get(name);
        if (index === undefined) return 0;
        return (this._frameGroups[index] || 0) + (this._frameLayers[index] || 0);
    }

    /**
     * Returns the `TOP_COUNT` names with the longest durations, slowest first. Names without a duration are not included.
     */
    _top(durations: Array<number>): Array<GroupPerformanceStatistics> {
        const result: Array<GroupPerformanceStatistics> = [];
        durations.forEach((durationMillis, index) => {
            if (durationMillis > 0) result.push({name: this._names[index]!, durationMillis});
        });
        return result.sort((a, b) => b.durationMillis - a.durationMillis).slice(0, TOP_COUNT);
    }
}
