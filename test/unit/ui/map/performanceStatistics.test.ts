import {test, expect, vi, createMap} from '../../../util/vitest';

import type {Map} from '../../../../src/ui/map';
import type {PerformanceSampler, PerformanceStatistics, PerformanceStatisticsOptions} from '../../../../src/util/performance_statistics';

function nextStatistics(map: Map, options: PerformanceStatisticsOptions = {samplers: ['cumulative', 'per-frame'], samplingDurationMillis: 0}) {
    return new Promise<PerformanceStatistics>((resolve) => {
        map.startPerformanceStatisticsCollection(options, resolve);
        map.triggerRepaint();
    });
}

function createLoadedMap(): Promise<Map> {
    const map: Map = createMap({
        style: {
            version: 8,
            sources: {},
            layers: [{id: 'background', type: 'background', paint: {'background-color': 'red'}}]
        }
    });
    return new Promise((resolve) => {
        map.once('load', () => resolve(map));
    });
}

test('Map#startPerformanceStatisticsCollection calls the callback at the end of a rendered frame', async () => {
    const map: Map = createMap();
    const statistics = await nextStatistics(map);
    expect(Object.keys(statistics).sort()).toEqual(['collectionDurationMillis', 'cumulativeStatistics', 'mapRenderDurationStatistics', 'perFrameStatistics']);
    map.remove();
});

test('Map#startPerformanceStatisticsCollection counts the draw calls of the rendered layers', async () => {
    const map = await createLoadedMap();
    const statistics = await nextStatistics(map);
    expect(statistics.cumulativeStatistics.drawCalls).toBeGreaterThan(0);
    map.remove();
});

test('Map#startPerformanceStatisticsCollection times the rendered layers', async () => {
    const map = await createLoadedMap();
    // A clock that advances on each read gives each layer a duration above zero.
    let time = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => ++time);
    const statistics = await nextStatistics(map);
    expect(statistics.perFrameStatistics.topRenderLayers.map(group => group.name)).toEqual(['background']);
    map.remove();
});

test('Map#startPerformanceStatisticsCollection throws for a negative sampling duration', () => {
    const map: Map = createMap();
    expect(() => map.startPerformanceStatisticsCollection({samplers: [], samplingDurationMillis: -1}, () => {})).toThrowError();
    map.remove();
});

test('Map#startPerformanceStatisticsCollection throws for an unknown sampler', () => {
    const map: Map = createMap();
    expect(() => map.startPerformanceStatisticsCollection({samplers: ['unknown' as PerformanceSampler], samplingDurationMillis: 0}, () => {})).toThrowError();
    map.remove();
});

test('Map#startPerformanceStatisticsCollection with invalid options keeps the running collection', async () => {
    const map: Map = createMap();
    const statistics = new Promise((resolve) => {
        map.startPerformanceStatisticsCollection({samplers: [], samplingDurationMillis: 0}, resolve);
    });
    expect(() => map.startPerformanceStatisticsCollection({samplingDurationMillis: 0} as PerformanceStatisticsOptions, () => {})).toThrowError();
    map.triggerRepaint();
    await expect(statistics).resolves.toBeDefined();
    map.remove();
});

test('Map#startPerformanceStatisticsCollection continues after the WebGL context is restored', () => {
    const map: Map = createMap();
    map.startPerformanceStatisticsCollection({samplers: [], samplingDurationMillis: 0}, () => {});
    const collector = map.painter.context.performanceStatistics;
    map._contextRestored(new Event('webglcontextrestored'));
    expect(map.painter.context.performanceStatistics).toBe(collector);
    map.remove();
});

test('Map#stopPerformanceStatisticsCollection stops the callbacks', async () => {
    const map: Map = createMap();
    let calls = 0;
    map.startPerformanceStatisticsCollection({samplers: [], samplingDurationMillis: 0}, () => calls++);
    map.stopPerformanceStatisticsCollection();
    await new Promise((resolve) => {
        map.once('render', resolve);
        map.triggerRepaint();
    });
    expect(calls).toEqual(0);
    map.remove();
});

test('Map#remove stops the delivery of a closed sampling window', async () => {
    const map: Map = createMap();
    let calls = 0;
    map.startPerformanceStatisticsCollection({samplers: [], samplingDurationMillis: 0}, () => calls++);
    await new Promise((resolve) => {
        map.once('render', () => {
            map.remove();
            resolve(undefined);
        });
        map.triggerRepaint();
    });
    expect(calls).toEqual(0);
});
