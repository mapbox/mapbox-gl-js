// @flow

import window from '../util/window.js';
const performance = window.performance;

performance.mark('library-evaluate');

import {isWorker} from '../util/util.js';
import type {RequestParameters} from '../util/ajax.js';

export type PerformanceMetrics = {
    loadTime: number,
    fullLoadTime: number,
    percentDroppedFrames: number,
    parseTile: number,
    parseTile1: number,
    parseTile2: number,
    workerTask: number,
    workerInitialization: number,
    workerEvaluateScript: number,
    workerIdle: number,
    workerIdlePercent: number,
    placementTime: number,
    timelines: Array<Object>
};

export const PerformanceMarkers = {
    create: 'create',
    load: 'load',
    fullLoad: 'fullLoad'
};

let fullLoadFinished = false;
let placementTime = 0;

export const PerformanceUtils = {
    mark(marker: $Keys<typeof PerformanceMarkers>) {
        performance.mark(marker);
    },
    measure(name: string, begin?: string, end?: string) {
        performance.measure(name, begin, end);
    },
    beginMeasure(name: string): PerformanceMark {
        const mark = name;
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
        performance.mark('frame', {
            detail: {
                timestamp,
                isRenderFrame
            }
        });
    },
    clearMetrics() {
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

        metrics.placementTime = placementTime;

        return metrics;
    },

    getWorkerPerformanceMetrics(): { timeOrigin: string, entries: Array<Object>, scope: string } {
        const entries = performance.getEntries().map(entry => {
            const result = entry.toJSON();
            if (entry.detail) {
                Object.assign(result, {
                    detail: entry.detail
                });
            }
            return result;
        });
        return {
            scope: isWorker() ? 'Worker' : 'Window',
            timeOrigin: performance.timeOrigin,
            entries
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
