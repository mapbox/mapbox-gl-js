// @flow

import window from './window.js';
import {version as sdkVersion} from '../../package.json';
import type Projection from '../geo/projection/projection.js';
import {
    isMapboxHTTPStyleURL,
    isMapboxHTTPTileJSONURL,
    isMapboxHTTPSpriteURL,
    isMapboxHTTPFontsURL
} from './mapbox.js';

type LivePerformanceMetrics = {
    counters: Array<Object>,
    metadata: Array<Object>,
    attributes: Array<Object>
};

export type LivePerformanceData = {
    interactionRange: [number, number],
    width: number,
    height: number,
    terrainEnabled: boolean,
    fogEnabled: boolean,
    projection: Projection,
    renderer: ?string,
    vendor: ?string
};

function categorize(arr, fn) {
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

function getTransferRangePerResourceType(resourceTimers) {
    const obj = {};
    if (resourceTimers) {
        for (const category in resourceTimers) {
            if (category !== 'other') {
                for (const timer of resourceTimers[category]) {
                    const min = `${category}TransferStart`;
                    const max = `${category}TransferEnd`;

                    // Resource -TransferStart and -TransferEnd represent the wall time
                    // between the start of a request to when the data is available
                    obj[min] = Math.min(obj[min] || +Infinity, timer.startTime);
                    obj[max] = Math.max(obj[max] || -Infinity, timer.responseEnd);
                }
            }
        }
    }
    return obj;
}

function getResourceCategory(entry: PerformanceResourceTiming): string {
    const url = entry.name.split('?')[0];

    // Code may be hosted on various endpoints: CDN, self-hosted,
    // from unpkg... so this check doesn't include mapbox HTTP URL
    if (url.includes('mapbox-gl.js')) return 'javascript';
    if (url.includes('mapbox-gl.css')) return 'css';

    if (isMapboxHTTPFontsURL(url)) return 'font';
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
                    return `${split[0]}:${split[1]}`;
                }
            }
        }
    }
}

export function getLivePerformanceMetrics(data: LivePerformanceData): LivePerformanceMetrics {
    const resourceTimers = window.performance.getEntriesByType('resource');
    const resourcesByType = categorize(resourceTimers, getResourceCategory);
    const counters = getTransferRangePerResourceType(resourcesByType);
    const devicePixelRatio = window.devicePixelRatio;
    const connection = window.navigator.connection || window.navigator.mozConnection || window.navigator.webkitConnection;
    const metrics = {counters: [], metadata: [], attributes: []};

    const addMetric = (arr, name, value) => {
        if (value) {
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

    addMetric(metrics.attributes, "style", getStyle(resourceTimers));
    addMetric(metrics.attributes, "terrainEnabled", data.terrainEnabled ? "true" : "false");
    addMetric(metrics.attributes, "fogEnabled", data.fogEnabled ? "true" : "false");
    addMetric(metrics.attributes, "projection", data.projection.name);

    addMetric(metrics.metadata, "devicePixelRatio", devicePixelRatio);
    addMetric(metrics.metadata, "connectionEffectiveType", connection ? connection.effectiveType : undefined);
    addMetric(metrics.metadata, "cpuCores", window.navigator.hardwareConcurrency);
    addMetric(metrics.metadata, "userAgent", window.navigator.userAgent);
    addMetric(metrics.metadata, "screenWidth", window.screen.width * devicePixelRatio);
    addMetric(metrics.metadata, "screenHeight", window.screen.height * devicePixelRatio);
    addMetric(metrics.metadata, "windowWidth", window.innerWidth * devicePixelRatio);
    addMetric(metrics.metadata, "windowHeight", window.innerHeight * devicePixelRatio);
    addMetric(metrics.metadata, "mapWidth", data.width);
    addMetric(metrics.metadata, "mapHeight", data.height);
    addMetric(metrics.metadata, "webglRenderer", data.renderer);
    addMetric(metrics.metadata, "webglVendor", data.vendor);
    addMetric(metrics.metadata, "sdkVersion", sdkVersion);
    addMetric(metrics.metadata, "sdkIdentifier", "mapbox-gl-js");

    return metrics;
}
