// @flow

import window from './window.js';
import {version as sdkVersion} from '../../package.json';
import {
    isMapboxHTTPStyleURL,
    isMapboxHTTPTileJSONURL,
    isMapboxHTTPSpriteURL,
    isMapboxHTTPFontsURL,
    isMapboxHTTPCDNURL
} from './mapbox.js';

type LivePerformanceMetrics = {
    counters: Array<Object>,
    metadata: Array<Object>,
    attributes: Array<Object>
};

export type LivePerformanceData = {
    interactionRange: [number, number],
    visibilityHidden: number,
    width: number,
    height: number,
    terrainEnabled: boolean,
    fogEnabled: boolean,
    projection: string,
    zoom: number,
    renderer: ?string,
    vendor: ?string
};

export const PerformanceMarkers = {
    create: 'create',
    load: 'load',
    fullLoad: 'fullLoad'
};

export const LivePerformanceUtils = {
    mark(marker: $Keys<typeof PerformanceMarkers>) {
        window.performance.mark(marker);
    },
    measure(name: string, begin?: string, end?: string) {
        window.performance.measure(name, begin, end);
    }
};

function categorize(arr: Array<PerformanceResourceTiming>, fn: (entry: PerformanceResourceTiming) => string): {[string]: Array<PerformanceResourceTiming>} {
    const obj = {};
    if (arr) {
        for (const item of arr) {
            const category = fn(item);
            if (obj[category] === undefined) {
                obj[category] = [];
            }
            obj[category].push(item);
        }
    }
    return obj;
}

function getCountersPerResourceType(resourceTimers: { [string]: Array<PerformanceResourceTiming> }) {
    const obj = {};
    if (resourceTimers) {
        for (const category in resourceTimers) {
            if (category !== 'other') {
                for (const timer of resourceTimers[category]) {
                    const min = `${category}ResolveRangeMin`;
                    const max = `${category}ResolveRangeMax`;
                    const reqCount = `${category}RequestCount`;
                    const reqCachedCount = `${category}RequestCachedCount`;

                    // Resource -TransferStart and -TransferEnd represent the wall time
                    // between the start of a request to when the data is available
                    obj[min] = Math.min(obj[min] || +Infinity, timer.startTime);
                    obj[max] = Math.max(obj[max] || -Infinity, timer.responseEnd);

                    const increment = (key: string) => {
                        if (obj[key] === undefined) {
                            obj[key] = 0;
                        }
                        ++obj[key];
                    };

                    const transferSizeSupported = timer.transferSize !== undefined;
                    if (transferSizeSupported) {
                        const resourceFetchedFromCache = (timer.transferSize === 0);
                        if (resourceFetchedFromCache) {
                            increment(reqCachedCount);
                        }
                    }
                    increment(reqCount);
                }
            }
        }
    }
    return obj;
}

function getResourceCategory(entry: PerformanceResourceTiming): string {
    const url = entry.name.split('?')[0];

    if (isMapboxHTTPCDNURL(url) && url.includes('mapbox-gl.js')) return 'javascript';
    if (isMapboxHTTPCDNURL(url) && url.includes('mapbox-gl.css')) return 'css';
    if (isMapboxHTTPFontsURL(url)) return 'fontRange';
    if (isMapboxHTTPSpriteURL(url)) return 'sprite';
    if (isMapboxHTTPStyleURL(url)) return 'style';
    if (isMapboxHTTPTileJSONURL(url)) return 'tilejson';

    return 'other';
}

function getStyle(resourceTimers: Array<PerformanceEntry>): ?string {
    if (resourceTimers) {
        for (const timer of resourceTimers) {
            const url = timer.name.split('?')[0];
            if (isMapboxHTTPStyleURL(url)) {
                const split = url.split('/').slice(-2);
                if (split.length === 2) {
                    return `mapbox://styles/${split[0]}/${split[1]}`;
                }
            }
        }
    }
}

export function getLivePerformanceMetrics(data: LivePerformanceData): LivePerformanceMetrics {
    const resourceTimers = window.performance.getEntriesByType('resource');
    const markerTimers = window.performance.getEntriesByType('mark');
    const resourcesByType = categorize(resourceTimers, getResourceCategory);
    const counters = getCountersPerResourceType(resourcesByType);
    const devicePixelRatio = window.devicePixelRatio;
    const connection = window.navigator.connection || window.navigator.mozConnection || window.navigator.webkitConnection;
    const metrics = {counters: [], metadata: [], attributes: []};

    // Please read carefully before adding or modifying the following metrics:
    // https://github.com/mapbox/gl-js-team/blob/main/docs/live_performance_metrics.md
    const addMetric = (arr: Array<{| name: string, value: string |}>, name: string, value: ?(number | string)) => {
        if (value !== undefined && value !== null) {
            arr.push({name, value: value.toString()});
        }
    };

    for (const counter in counters) {
        addMetric(metrics.counters, counter, counters[counter]);
    }
    if (data.interactionRange[0] !== +Infinity && data.interactionRange[1] !== -Infinity) {
        addMetric(metrics.counters, "interactionRangeMin", data.interactionRange[0]);
        addMetric(metrics.counters, "interactionRangeMax", data.interactionRange[1]);
    }
    if (markerTimers) {
        for (const marker of Object.keys(PerformanceMarkers)) {
            const markerName = PerformanceMarkers[marker];
            const markerTimer = markerTimers.find((entry) => entry.name === markerName);
            if (markerTimer) {
                addMetric(metrics.counters, markerName, markerTimer.startTime);
            }
        }
    }
    addMetric(metrics.counters, "visibilityHidden", data.visibilityHidden);

    addMetric(metrics.attributes, "style", getStyle(resourceTimers));
    addMetric(metrics.attributes, "terrainEnabled", data.terrainEnabled ? "true" : "false");
    addMetric(metrics.attributes, "fogEnabled", data.fogEnabled ? "true" : "false");
    addMetric(metrics.attributes, "projection", data.projection);
    addMetric(metrics.attributes, "zoom", data.zoom);

    addMetric(metrics.metadata, "devicePixelRatio", devicePixelRatio);
    addMetric(metrics.metadata, "connectionEffectiveType", connection ? connection.effectiveType : undefined);
    addMetric(metrics.metadata, "navigatorUserAgent", window.navigator.userAgent);
    addMetric(metrics.metadata, "screenWidth", window.screen.width);
    addMetric(metrics.metadata, "screenHeight", window.screen.height);
    addMetric(metrics.metadata, "windowWidth", window.innerWidth);
    addMetric(metrics.metadata, "windowHeight", window.innerHeight);
    addMetric(metrics.metadata, "mapWidth", data.width / devicePixelRatio);
    addMetric(metrics.metadata, "mapHeight", data.height / devicePixelRatio);
    addMetric(metrics.metadata, "webglRenderer", data.renderer);
    addMetric(metrics.metadata, "webglVendor", data.vendor);
    addMetric(metrics.metadata, "sdkVersion", sdkVersion);
    addMetric(metrics.metadata, "sdkIdentifier", "mapbox-gl-js");

    return metrics;
}
