import {LivePerformanceMarkers} from '../util/live_performance';

export const PerformanceMarkers = {
    libraryEvaluate: 'library-evaluate',
    frameGPU: 'frame-gpu',
    frame: 'frame'
} as const;

import {isWorker} from '../util/util';
import type {RequestParameters} from '../util/ajax';

export type PerformanceMetrics = {
    loadTime: number;
    fullLoadTime: number;
    percentDroppedFrames: number;
    parseTile: number;
    parseTile1: number;
    parseTile2: number;
    workerTask: number;
    workerInitialization: number;
    workerEvaluateScript: number;
    workerIdle: number;
    workerIdlePercent: number;
    placementTime: number;
    timelines: Array<any>;
};

export type PerformanceMark = {
    mark: string;
    name: string;
};

type PerformanceMarkOptions = {
    detail?: unknown;
    startTime?: number;
};

let fullLoadFinished = false;
let placementTime = 0;

export const PerformanceUtils = {
    mark(marker: typeof PerformanceMarkers[keyof typeof PerformanceMarkers], markOptions?: PerformanceMarkOptions) {
        performance.mark(marker, markOptions);

        // @ts-expect-error - TS2367 - This comparison appears to be unintentional because the types '"frame" | "library-evaluate" | "frame-gpu"' and '"fullLoad"' have no overlap.
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
        const metrics: Record<string, any> = {};

        performance.measure('loadTime', LivePerformanceMarkers.create, LivePerformanceMarkers.load);
        performance.measure('fullLoadTime', LivePerformanceMarkers.create, LivePerformanceMarkers.fullLoad);

        const measures = performance.getEntriesByType('measure');
        for (const measure of measures) {
            metrics[measure.name] = (metrics[measure.name] || 0) + measure.duration;
        }

        metrics.placementTime = placementTime;

        // @ts-expect-error - TS2740 - Type 'Record<string, any>' is missing the following properties from type 'PerformanceMetrics': loadTime, fullLoadTime, percentDroppedFrames, parseTile, and 9 more.
        return metrics;
    },

    getWorkerPerformanceMetrics(): {
        timeOrigin: string;
        entries: Array<any>;
        scope: string;
        } {
        const entries = performance.getEntries().map(entry => {
            const result = entry.toJSON();
            // @ts-expect-error - TS2339 - Property 'detail' does not exist on type 'PerformanceEntry'.
            if (entry.detail) {
                Object.assign(result, {
                    // @ts-expect-error - TS2339 - Property 'detail' does not exist on type 'PerformanceEntry'.
                    detail: entry.detail
                });
            }
            return result;
        });
        return {
            scope: isWorker() ? 'Worker' : 'Window',
            // @ts-expect-error - TS2322 - Type 'number' is not assignable to type 'string'.
            timeOrigin: performance.timeOrigin,
            entries
        };
    }
} as const;

PerformanceUtils.mark(PerformanceMarkers.libraryEvaluate);

export function getPerformanceMeasurement(request?: RequestParameters | null): Array<PerformanceEntry> {
    const url = request ? request.url.toString() : undefined;
    if (!url) {
        return [];
    }
    return performance.getEntriesByName(url);
}

export default performance;
