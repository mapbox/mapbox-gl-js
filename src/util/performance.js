// @flow

import window from '../util/window.js';
import type {RequestParameters} from '../util/ajax.js';

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
    workerIdlePercent: number,
    placementTime: number
};

export type PerformanceMark = {mark: string, name: string};

export const PerformanceMarkers = {
    create: 'create',
    load: 'load',
    fullLoad: 'fullLoad'
};

let lastFrameTime = null;
let fullLoadFinished = false;
let frameTimes = [];
let placementTime = 0;
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

        if (marker === PerformanceMarkers.fullLoad) {
            fullLoadFinished = true;
        }
    },
    measure(name: string, begin?: string, end?: string) {
        performance.measure(name, begin, end);
    },
    beginMeasure(name: string): PerformanceMark {
        const mark = name + i++;
        performance.mark(mark);
        return {
            mark,
            name
        };
    },
    endMeasure(m: PerformanceMark) {
        performance.measure(m.name, m.mark);
    },
    recordPlacementTime(time: number) {
        // Ignore placementTimes during loading
        if (!fullLoadFinished) {
            return;
        }

        placementTime += time;
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
        placementTime = 0;
        fullLoadFinished = false;

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

        metrics.placementTime = placementTime;

        return metrics;
    },

    getWorkerPerformanceMetrics(): { timeOrigin: string, measures: Array<PerformanceEntry> } {
        return JSON.parse(JSON.stringify({
            timeOrigin: performance.timeOrigin,
            measures: performance.getEntriesByType("measure")
        }));
    }
};

export function getPerformanceMeasurement(request: ?RequestParameters): Array<PerformanceEntry> {
    const url = request ? request.url.toString() : undefined;
    return performance.getEntriesByName(url);
}

export default performance;
