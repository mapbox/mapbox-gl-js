// @flow

import {
    PerformanceMarkers,
    LivePerformanceUtils
} from '../util/live_performance.js';

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

export type PerformanceMark = {mark: string, name: string};

let fullLoadFinished = false;
let placementTime = 0;

export const PerformanceUtils = {
    mark(marker: $Keys<typeof PerformanceMarkers>) {
        LivePerformanceUtils.mark(marker);

        if (marker === PerformanceMarkers.fullLoad) {
            fullLoadFinished = true;
        }
    },
    measure(name: string, begin?: string, end?: string) {
        LivePerformanceUtils.measure(name, begin, end);
    },
    beginMeasure(name: string): PerformanceMark {
        const mark = name;
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
        // $FlowFixMe[extra-arg]
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
            // $FlowFixMe[prop-missing]
            if (entry.detail) {
                // $FlowFixMe[incompatible-use]
                Object.assign(result, {
                    detail: entry.detail
                });
            }
            return result;
        });
        return {
            scope: isWorker() ? 'Worker' : 'Window',
            // $FlowFixMe[prop-missing]
            timeOrigin: performance.timeOrigin,
            entries
        };
    }
};

export function getPerformanceMeasurement(request: ?RequestParameters): Array<PerformanceEntry> {
    const url = request ? request.url.toString() : undefined;
    if (!url) {
        return [];
    }
    return performance.getEntriesByName(url);
}

export default performance;
