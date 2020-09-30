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
let i = 0;

const minFramerateTarget = 30;
const frameTimeTarget = 1000 / minFramerateTarget;

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
    frame(timestamp: number) {
        const currTimestamp = timestamp;
        if (lastFrameTime != null) {
            const frameTime = currTimestamp - lastFrameTime;
            frameTimes.push(frameTime);
        }
        lastFrameTime = currTimestamp;
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

        const totalFrames = frameTimes.length;

        const avgFrameTime = frameTimes.reduce((prev, curr) => prev + curr, 0) / totalFrames / 1000;
        metrics.fps = 1 / avgFrameTime;

        // count frames that missed our framerate target
        const droppedFrames = frameTimes
            .filter((frameTime) => frameTime > frameTimeTarget)
            .reduce((acc, curr) => {
                return acc + (curr -  frameTimeTarget) / frameTimeTarget;
            }, 0);
        metrics.percentDroppedFrames = (droppedFrames / (totalFrames + droppedFrames)) * 100;

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
