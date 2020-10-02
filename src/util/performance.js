// @flow

import window from '../util/window';
import type {RequestParameters} from '../util/ajax';

const performance = window.performance;

export type PerformanceMetrics = {
    loadTime: number,
    fullLoadTime: number,
    fps: number,
    percentDroppedFrames: number,
    parseTile: number,
    parseTile1: number,
    parseTile2: number,
    workerTask: number,
    workerInitialization: number,
    workerEvaluateScript: number,
    workerIdle: number,
    workerIdlePercent: number
};

export const PerformanceMarkers = {
    create: 'create',
    load: 'load',
    fullLoad: 'fullLoad'
};

let lastFrameTime = null;
let frameTimes = [];
const frameSequences = [frameTimes];
let i = 0;

// The max milliseconds we should spend to render a single frame.
// This value may need to be tweaked. I chose 14 by increasing frame
// times with busy work and measuring the number of dropped frames.
// On a page with only a map, more frames started being dropped after
// going above 14ms. We might want to lower this to leave more room
// for other work.
const CPU_FRAME_BUDGET = 14;

const framerateTarget = 60;
const frameTimeTarget = 1000 / framerateTarget;

export const PerformanceUtils = {
    mark(marker: $Keys<typeof PerformanceMarkers>) {
        performance.mark(marker);
    },
    measure(name: string, begin?: string, end?: string) {
        performance.measure(name, begin, end);
    },
    beginMeasure(name: string) {
        const mark = name + i++;
        performance.mark(mark);
        return {
            mark,
            name
        };
    },
    endMeasure(m: { name: string, mark: string }) {
        performance.measure(m.name, m.mark);
    },
    frame(timestamp: number, isRenderFrame: boolean) {
        const currTimestamp = timestamp;
        if (lastFrameTime != null) {
            const frameTime = currTimestamp - lastFrameTime;
            frameTimes.push(frameTime);
        }

        if (isRenderFrame) {
            lastFrameTime = currTimestamp;
        } else {
            lastFrameTime = null;
            frameTimes = [];
            frameSequences.push(frameTimes);
        }
    },
    clearMetrics() {
        lastFrameTime = null;
        frameTimes = [];
        performance.clearMeasures('loadTime');
        performance.clearMeasures('fullLoadTime');

        for (const marker in PerformanceMarkers) {
            performance.clearMarks(PerformanceMarkers[marker]);
        }
    },

    getPerformanceMetrics(): PerformanceMetrics {
        const metrics = {};

        performance.measure('loadTime', PerformanceMarkers.create, PerformanceMarkers.load);
        performance.measure('fullLoadTime', PerformanceMarkers.create, PerformanceMarkers.fullLoad);

        const measures = performance.getEntriesByType('measure');
        for (const measure of measures) {
            metrics[measure.name] = (metrics[measure.name] || 0) + measure.duration;
        }

        // We don't have a perfect way of measuring the actual number of dropped frames.
        // The best way of determining when frames happen is the timestamp passed to
        // requestAnimationFrame. In Chrome and Firefox the timestamps are generally
        // multiples of 1000/60ms (+-2ms).
        //
        // The differences between the timestamps vary a lot more in Safari.
        // It's not uncommon to see a 24ms difference followedd by a 8ms difference.
        // I'm not sure, but I think these might not be dropped frames (due to multiple
        // buffering?).
        //
        // For Safari, I think comparing the number of expected frames with the number of actual
        // frames is a more accurate way of measuring dropped frames than comparing
        // individual frame time differences to a target time. In Firefox and Chrome
        // both approaches produce the same result most of the time.
        let droppedFrames = 0;
        let totalFrameTimeSum = 0;
        let totalFrames = 0;
        metrics.jank = 0;

        for (const frameTimes of frameSequences) {
            if (!frameTimes.length) continue;
            const frameTimeSum = frameTimes.reduce((prev, curr) => prev + curr, 0);
            const expectedFrames = Math.max(1, Math.round(frameTimeSum / frameTimeTarget));
            droppedFrames += expectedFrames - frameTimes.length;
            totalFrameTimeSum += frameTimeSum;
            totalFrames += frameTimes.length;

            // Jank is a change in the frame rate.
            // Count the number of times a frame has a worse rate than the previous frame.
            // A consistent rate does not increase jank even if it is continuosly dropping frames.
            // A one-off frame does not increase jank even if it is really long.
            //
            // This is not that accurate in Safari because the differences between animation frame
            // times is not as close to a multiple of 1000/60ms.
            const roundedTimes = frameTimes.map(frameTime => Math.max(1, Math.round(frameTime / frameTimeTarget)));
            for (let n = 0; n < roundedTimes.length - 1; n++) {
                if (roundedTimes[n + 1] > roundedTimes[n]) {
                    metrics.jank++;
                }
            }
        }
        const avgFrameTime = totalFrameTimeSum / totalFrames / 1000;
        metrics.fps = 1 / avgFrameTime;
        metrics.droppedFrames = droppedFrames;
        metrics.percentDroppedFrames = (droppedFrames / (totalFrames + droppedFrames)) * 100;

        metrics.cpuFrameBudgetExceeded = 0;
        const renderFrames = performance.getEntriesByName('render');
        for (const renderFrame of renderFrames) {
            metrics.cpuFrameBudgetExceeded += Math.max(0, renderFrame.duration - CPU_FRAME_BUDGET);
        }

        return metrics;
    },

    getWorkerPerformanceMetrics() {
        return JSON.parse(JSON.stringify({
            timeOrigin: performance.timeOrigin,
            measures: performance.getEntriesByType("measure")
        }));
    }
};

/**
 * Safe wrapper for the performance resource timing API in web workers with graceful degradation
 *
 * @param {RequestParameters} request
 * @private
 */
export class RequestPerformance {
    _marks: {start: string, end: string, measure: string};

    constructor (request: RequestParameters) {
        this._marks = {
            start: [request.url, 'start'].join('#'),
            end: [request.url, 'end'].join('#'),
            measure: request.url.toString()
        };

        performance.mark(this._marks.start);
    }

    finish() {
        performance.mark(this._marks.end);
        let resourceTimingData = performance.getEntriesByName(this._marks.measure);

        // fallback if web worker implementation of perf.getEntriesByName returns empty
        if (resourceTimingData.length === 0) {
            performance.measure(this._marks.measure, this._marks.start, this._marks.end);
            resourceTimingData = performance.getEntriesByName(this._marks.measure);

            // cleanup
            performance.clearMarks(this._marks.start);
            performance.clearMarks(this._marks.end);
            performance.clearMeasures(this._marks.measure);
        }

        return resourceTimingData;
    }
}

export default performance;
