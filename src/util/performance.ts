import {isWorker} from '../util/util';
import {LivePerformanceMarkers} from '../util/live_performance';

import type {RequestParameters} from '../util/ajax';

declare global {
    interface Console {
        // Chrome DevTools extension: timeStamp accepts extra args for performance tracing
        // eslint-disable-next-line @typescript-eslint/method-signature-style
        timeStamp(label?: string, start?: string | number, end?: string | number, trackName?: string): void;
    }
}

export const PerformanceMarkers = {
    libraryEvaluate: 'library-evaluate',
    frameGPU: 'frame-gpu',
    frame: 'frame'
} as const;

export type PerformanceMarker =
    | typeof PerformanceMarkers[keyof typeof PerformanceMarkers]
    | typeof LivePerformanceMarkers[keyof typeof LivePerformanceMarkers];

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

export type PerformanceMeasureDevToolsColor =
  "primary" | "primary-light" | "primary-dark"
  | "secondary" | "secondary-light" | "secondary-dark"
  | "tertiary" | "tertiary-light" | "tertiary-dark"
  | "error";

// To ensure there is not overlap in zones, use worker name or 'Main' as track and actual track name as trackgroup
function trackNameOrDefault() {
    return (isWorker(self) && self.name) ? `${self.name}` : "Main";
}

let performanceUtilsGroupsMask: number = 0;

export const PerformanceUtils = {
    GROUP_NONE: 0,
    GROUP_COMMON: 1 << 1,
    GROUP_RENDERING: 1 << 2,
    GROUP_RENDERING_DETAILED: 1 << 3,

    now() {
        return performance.now();
    },

    mark(marker: PerformanceMarker, markOptions?: PerformanceMarkOptions) {
        performance.mark(marker, markOptions);
    },

    // Bitmask to enable profiling groups
    // e.g. PerformanceUtils.GROUP_COMMON | PerformanceUtils.GROUP_RENDERING
    setEnabledGroupsMask(mask: number) {
        performanceUtilsGroupsMask = mask;
    },

    enabledGroupsMask(): number {
        return performanceUtilsGroupsMask;
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    measureWithDetails(grpMask: number, name: string, track: string, startTime: number, properties?: any[][], color?: PerformanceMeasureDevToolsColor) {
        if ((grpMask & performanceUtilsGroupsMask) === 0) return;
        performance.measure(name, {start: startTime, detail: {
            devtools: {
                trackGroup: track,
                track: trackNameOrDefault(),
                properties,
                color
            }
        }});
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    markWithDetails(grpMask: number, name: string, properties?: any[][], color?: PerformanceMeasureDevToolsColor) {
        if ((grpMask & performanceUtilsGroupsMask) === 0) return;
        performance.mark(name, {
            detail: {
                devtools: {
                    dataType: "marker",
                    color,
                    properties,
                }
            }
        });
    },

    // Based on console.timeStamp()
    // Records timing measures to DevTools performance panel only
    // Low overhead, but not recorded on Chrome timeline.
    measureLowOverhead(
        grpMask: number,
        label: string,
        start?: string | number,
        end?: string | number,
        trackName?: string
    ) {
        if ((grpMask & performanceUtilsGroupsMask) === 0) return;
        console.timeStamp(label, start, end !== undefined ? end : performance.now(), trackNameOrDefault());
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    endMeasure(m: PerformanceMark, properties?: any[][]) {
        performance.measure(m.name, {
            start: m.mark,
            detail: {
                devtools: {
                    track: trackNameOrDefault(),
                    properties
                }
            }
        });
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
        for (const marker in LivePerformanceMarkers) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            performance.clearMarks(LivePerformanceMarkers[marker]);
        }
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
