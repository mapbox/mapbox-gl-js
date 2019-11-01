// @flow

import type {RequestParameters} from '../util/ajax';

// Wraps performance to facilitate testing
// Not incorporated into browser.js because the latter is poisonous when used outside the main thread
const performanceExists = typeof performance !== 'undefined';

const wrapper = {};

wrapper.getEntriesByName = (url: string) => {
    if (performanceExists && performance && performance.getEntriesByName)
        return performance.getEntriesByName(url);
    else
        return false;
};

wrapper.mark = (name: string) => {
    if (performanceExists && performance && performance.mark)
        return performance.mark(name);
    else
        return false;
};

wrapper.measure = (name: string, startMark: string, endMark: string) => {
    if (performanceExists && performance && performance.measure)
        return performance.measure(name, startMark, endMark);
    else
        return false;
};

wrapper.clearMarks = (name: string) => {
    if (performanceExists && performance && performance.clearMarks)
        return performance.clearMarks(name);
    else
        return false;
};

wrapper.clearMeasures = (name: string) => {
    if (performanceExists && performance && performance.clearMeasures)
        return performance.clearMeasures(name);
    else
        return false;
};

export const PerformanceMarkers = {
    create: 'create',
    load: 'load',
    fullLoad: 'full-load'
};

let lastFrameTime = null;
let frameTimes = [];

wrapper.frame = () => {
    const currTimestamp = performance.now();
    if (lastFrameTime != null) {
        const frameTime = currTimestamp - lastFrameTime;
        frameTimes.push(frameTime);
    }
    lastFrameTime = currTimestamp;
};

wrapper.clearMetrics = () => {
    lastFrameTime = null;
    frameTimes = [];
    wrapper.clearMeasures('loadTime');
    wrapper.clearMeasures('fullLoadTime');

    for (const marker in PerformanceMarkers) {
        wrapper.clearMarks(PerformanceMarkers[marker]);
    }
};

export type PerformanceMetrics = {
    loadTime: number,
    fullLoadTime: number,
    frameTimes: Array<number>,
    fps: number,
    onePercentLowFps: number
}

export function getPerformanceMetrics(): PerformanceMetrics {
    const loadTime = wrapper.measure('loadTime', PerformanceMarkers.create, PerformanceMarkers.load).duration;
    const fullLoadTime = wrapper.measure('fullLoadTime', PerformanceMarkers.create, PerformanceMarkers.fullLoad).duration;
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

/**
 * Safe wrapper for the performance resource timing API in web workers with graceful degradation
 *
 * @param {RequestParameters} request
 * @private
 */
class Performance {
    _marks: {start: string, end: string, measure: string};

    constructor (request: RequestParameters) {
        this._marks = {
            start: [request.url, 'start'].join('#'),
            end: [request.url, 'end'].join('#'),
            measure: request.url.toString()
        };

        wrapper.mark(this._marks.start);
    }

    finish() {
        wrapper.mark(this._marks.end);
        let resourceTimingData = wrapper.getEntriesByName(this._marks.measure);

        // fallback if web worker implementation of perf.getEntriesByName returns empty
        if (resourceTimingData.length === 0) {
            wrapper.measure(this._marks.measure, this._marks.start, this._marks.end);
            resourceTimingData = wrapper.getEntriesByName(this._marks.measure);

            // cleanup
            wrapper.clearMarks(this._marks.start);
            wrapper.clearMarks(this._marks.end);
            wrapper.clearMeasures(this._marks.measure);
        }

        return resourceTimingData;
    }
}

wrapper.Performance = Performance;

export default wrapper;
