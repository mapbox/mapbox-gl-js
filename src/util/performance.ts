import {isWorker} from '../util/util';
import {LivePerformanceMarkers} from '../util/live_performance';

import type {RequestParameters} from '../util/ajax';

export const PerformanceMarkers = {
    libraryEvaluate: 'library-evaluate',
    frameGPU: 'frame-gpu',
    frame: 'frame'
} as const;

export type PerformanceMarker =
    | typeof PerformanceMarkers[keyof typeof PerformanceMarkers]
    | typeof LivePerformanceMarkers[keyof typeof LivePerformanceMarkers];

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
    timelines: WorkerPerformanceMetrics[];
};

export type WorkerPerformanceMetrics = {
    timeOrigin: number;
    entries: Array<PerformanceEntry & PerformanceMarkOptions>;
    scope: string;
};

export type PerformanceMark = {
    mark: string;
    name: string;
};

export type PerformanceMarkDetail = {
    gpuTime?: number;
    cpuTime?: number;
    timestamp?: number
    isRenderFrame?: boolean;
};

type PerformanceMarkOptions = {
    detail?: PerformanceMarkDetail;
    startTime?: number;
};

let fullLoadFinished = false;
let placementTime = 0;

export const PerformanceUtils = {
    mark(marker: PerformanceMarker, markOptions?: PerformanceMarkOptions) {
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
        const metrics: Partial<PerformanceMetrics> = {};

        performance.measure('loadTime', LivePerformanceMarkers.create, LivePerformanceMarkers.load);
        performance.measure('fullLoadTime', LivePerformanceMarkers.create, LivePerformanceMarkers.fullLoad);

        const measures = performance.getEntriesByType('measure');
        for (const measure of measures) {
            metrics[measure.name] = (metrics[measure.name] || 0) + measure.duration;
        }

        metrics.placementTime = placementTime;

        return metrics as PerformanceMetrics;
    },

    getWorkerPerformanceMetrics(): WorkerPerformanceMetrics {
        const entries = performance.getEntries().map((entry: PerformanceEntry & PerformanceMarkOptions) => {
            const result: PerformanceEntry & PerformanceMarkOptions = entry.toJSON();
            if (entry.detail) Object.assign(result, {detail: entry.detail});
            return result;
        });

        return {
            scope: isWorker(self) ? 'Worker' : 'Window',
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
