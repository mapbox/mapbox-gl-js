// @flow

import window from '../util/window';
import type {RequestParameters} from '../util/ajax';

const performance = window.performance;

export type PerformanceMetrics = {
    loadTime: number,
    fullLoadTime: number,
    frameTimes: Array<number>,
    fps: number,
    onePercentLowFps: number
}

export const PerformanceMarkers = {
    create: 'create',
    load: 'load',
    fullLoad: 'full-load'
};

let lastFrameTime = null;
let frameTimes = [];

export const PerformanceUtils = {
    frame() {
        const currTimestamp = performance.now();
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
        const loadTime = performance.measure('loadTime', PerformanceMarkers.create, PerformanceMarkers.load).duration;
        const fullLoadTime = performance.measure('fullLoadTime', PerformanceMarkers.create, PerformanceMarkers.fullLoad).duration;
        const totalFrames = frameTimes.length;

        const avgFrameTime = frameTimes.reduce((prev, curr) => prev + curr, 0) / totalFrames / 1000;
        const fps = 1 / avgFrameTime;

        // Sort frametimes, in descending order to get the 1% slowest frames
        const onePercentLowFrameTimes = frameTimes.slice().sort((a, b) => b - a)
            .slice(0, totalFrames * 0.01 | 0);

        const onePercentLowFrameTime = onePercentLowFrameTimes.reduce((prev, curr) => prev + curr, 0) / onePercentLowFrameTimes.length / 1000;
        const onePercentLowFps = 1 / onePercentLowFrameTime;
        return {
            loadTime,
            fullLoadTime,
            frameTimes,
            fps,
            onePercentLowFps
        };
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
