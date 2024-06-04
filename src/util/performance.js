// @flow

import {LivePerformanceMarkers} from '../util/live_performance.js';

export const PerformanceMarkers = {
    libraryEvaluate: 'library-evaluate',
    frameGPU: 'frame-gpu',
    frame: 'frame'
};

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

type PerformanceMarkOptions = {
    detail?: mixed;
    startTime?: number;
}

let fullLoadFinished = false;
let placementTime = 0;

export const PerformanceUtils = {
    mark(marker: $Values<typeof PerformanceMarkers>, markOptions?: PerformanceMarkOptions) {
        // $FlowFixMe extra-arg: fixed in later Flow versions
        performance.mark(marker, markOptions);

        if (marker === LivePerformanceMarkers.fullLoad) {
            fullLoadFinished = true;
        }
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
        performance.mark(PerformanceMarkers.frame, {
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

        for (const marker in LivePerformanceMarkers) {
            performance.clearMarks(LivePerformanceMarkers[marker]);
        }
    },

    getPerformanceMetrics(): PerformanceMetrics {
        const metrics = {};

        performance.measure('loadTime', LivePerformanceMarkers.create, LivePerformanceMarkers.load);
        performance.measure('fullLoadTime', LivePerformanceMarkers.create, LivePerformanceMarkers.fullLoad);

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

PerformanceUtils.mark(PerformanceMarkers.libraryEvaluate);

export function getPerformanceMeasurement(request: ?RequestParameters): Array<PerformanceEntry> {
    const url = request ? request.url.toString() : undefined;
    if (!url) {
        return [];
    }
    return performance.getEntriesByName(url);
}

export default performance;
