import {describe, test, expect, vi} from '../../util/vitest';
import {PerformanceStatisticsCollector} from '../../../src/util/performance_statistics';

import type {PerformanceStatistics, PerformanceStatisticsOptions} from '../../../src/util/performance_statistics';

type Collection = {
    stats: PerformanceStatisticsCollector;
    results: Array<PerformanceStatistics>;
    setTime: (time: number) => void;
};

function startCollection(options: Partial<PerformanceStatisticsOptions> = {}, programCount = 0): Collection {
    let time = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => time);
    const results: Array<PerformanceStatistics> = [];
    const stats = new PerformanceStatisticsCollector(
        {samplers: [], samplingDurationMillis: 100, ...options}, programCount, (statistics) => results.push(statistics));
    return {stats, results, setTime: (t) => { time = t; }};
}

function renderFrame({stats, setTime}: Collection, start: number, duration: number, draw?: () => void) {
    setTime(start);
    stats.beginFrame();
    if (draw) draw();
    setTime(start + duration);
    stats.endFrame();
}

function deliveries() {
    return new Promise((resolve) => { setTimeout(resolve); });
}

function timeLayer({stats, setTime}: Collection, id: string, start: number, end: number) {
    setTime(end);
    stats.recordLayer(id, start);
}

describe('PerformanceStatisticsCollector', () => {
    test('does not call the callback before the sampling window closes', async () => {
        const collection = startCollection();
        renderFrame(collection, 0, 10);
        await deliveries();
        expect(collection.results).toEqual([]);
    });

    test('returns the window duration and render statistics when the window closes', async () => {
        const collection = startCollection({samplingDurationMillis: 150});
        renderFrame(collection, 0, 10);
        renderFrame(collection, 40, 30);
        renderFrame(collection, 80, 20);
        renderFrame(collection, 120, 40);
        await deliveries();
        expect(collection.results).toEqual([{
            collectionDurationMillis: 160,
            mapRenderDurationStatistics: {maxMillis: 40, medianMillis: 25}
        }]);
    });

    test('closes a window every frame for a zero sampling duration', async () => {
        const collection = startCollection({samplingDurationMillis: 0});
        renderFrame(collection, 0, 5);
        renderFrame(collection, 10, 5);
        await deliveries();
        expect(collection.results.length).toEqual(2);
    });

    test('truncates the sampling duration to whole milliseconds', async () => {
        const collection = startCollection({samplingDurationMillis: 10.9});
        renderFrame(collection, 0, 10);
        await deliveries();
        expect(collection.results.length).toEqual(1);
    });

    test('starts a new window after a window closes', async () => {
        const collection = startCollection();
        renderFrame(collection, 0, 200);
        renderFrame(collection, 250, 10);
        await deliveries();
        expect(collection.results.length).toEqual(1);
    });

    test('does not deliver a closed window after stop', async () => {
        const collection = startCollection({samplingDurationMillis: 0});
        renderFrame(collection, 0, 5);
        collection.stats.stop();
        await deliveries();
        expect(collection.results).toEqual([]);
    });

    test('ignores a frame that was already running when collection started', async () => {
        const collection = startCollection({samplingDurationMillis: 0});
        collection.stats.endFrame();
        await deliveries();
        expect(collection.results).toEqual([]);
    });

    test('returns the counters of the cumulative sampler', async () => {
        const collection = startCollection({samplers: ['cumulative'], samplingDurationMillis: 0}, 3);
        renderFrame(collection, 0, 10, () => {
            collection.stats.drawCalls += 7;
            collection.stats.fboSwitchCount += 2;
            collection.setTime(5);
            collection.stats.recordProgramCreation(1);
        });
        await deliveries();
        expect(collection.results[0].cumulativeStatistics).toEqual({
            drawCalls: 7,
            graphicsPrograms: 4,
            graphicsProgramsCreationTimeMillis: 4,
            fboSwitchCount: 2
        });
    });

    test('counts the draw calls of the last frame only', async () => {
        const collection = startCollection({samplers: ['cumulative']});
        renderFrame(collection, 0, 10, () => { collection.stats.drawCalls += 50; });
        renderFrame(collection, 150, 10, () => { collection.stats.drawCalls += 5; });
        await deliveries();
        expect(collection.results[0].cumulativeStatistics.drawCalls).toEqual(5);
    });

    test('returns the slowest frame of each layer, slowest first', async () => {
        const collection = startCollection({samplers: ['per-frame']});
        renderFrame(collection, 0, 10, () => {
            timeLayer(collection, 'water', 0, 2);
            timeLayer(collection, 'roads', 2, 5);
        });
        renderFrame(collection, 100, 10, () => timeLayer(collection, 'water', 100, 106));
        await deliveries();
        expect(collection.results[0].perFrameStatistics.topRenderLayers).toEqual([
            {name: 'water', durationMillis: 6},
            {name: 'roads', durationMillis: 3}
        ]);
    });

    test('adds the durations of one layer in one frame', async () => {
        const collection = startCollection({samplers: ['per-frame'], samplingDurationMillis: 0});
        renderFrame(collection, 0, 10, () => {
            timeLayer(collection, 'building', 0, 2);
            timeLayer(collection, 'building', 3, 6);
        });
        await deliveries();
        expect(collection.results[0].perFrameStatistics.topRenderLayers).toEqual([{name: 'building', durationMillis: 5}]);
    });

    test('includes render passes and layers in the render groups', async () => {
        const collection = startCollection({samplers: ['per-frame'], samplingDurationMillis: 0});
        renderFrame(collection, 0, 10, () => {
            collection.setTime(8);
            collection.stats.recordGroup('translucent', 0);
            timeLayer(collection, 'water', 1, 3);
        });
        await deliveries();
        expect(collection.results[0].perFrameStatistics.topRenderGroups).toEqual([
            {name: 'translucent', durationMillis: 8},
            {name: 'water', durationMillis: 2}
        ]);
    });

    test('limits the render groups and layers to the 10 slowest', async () => {
        const collection = startCollection({samplers: ['per-frame'], samplingDurationMillis: 0});
        renderFrame(collection, 0, 20, () => {
            for (let i = 0; i < 12; i++) timeLayer(collection, `layer-${i}`, 0, i + 1);
        });
        await deliveries();
        const {topRenderGroups, topRenderLayers} = collection.results[0].perFrameStatistics;
        expect([topRenderGroups.length, topRenderLayers.length]).toEqual([10, 10]);
    });

    test('counts a frame without a shadow pass as zero shadow time', async () => {
        const collection = startCollection({samplers: ['per-frame']});
        renderFrame(collection, 0, 10, () => {
            collection.setTime(4);
            collection.stats.recordGroup('shadowmap', 0);
        });
        renderFrame(collection, 100, 10);
        await deliveries();
        expect(collection.results[0].perFrameStatistics.shadowMapDurationStatistics).toEqual({maxMillis: 4, medianMillis: 2});
    });

    test('returns the upload duration of each frame', async () => {
        const collection = startCollection({samplers: ['per-frame']});
        renderFrame(collection, 0, 10, () => {
            collection.setTime(3);
            collection.stats.recordGroup('upload', 0);
        });
        renderFrame(collection, 100, 10, () => {
            collection.setTime(107);
            collection.stats.recordGroup('upload', 100);
        });
        await deliveries();
        expect(collection.results[0].perFrameStatistics.uploadDurationStatistics).toEqual({maxMillis: 7, medianMillis: 5});
    });

    test('does not return a layer that is only in earlier sampling windows', async () => {
        const collection = startCollection({samplers: ['per-frame'], samplingDurationMillis: 0});
        renderFrame(collection, 0, 10, () => timeLayer(collection, 'water', 0, 2));
        renderFrame(collection, 10, 10, () => timeLayer(collection, 'roads', 10, 12));
        await deliveries();
        expect(collection.results[1].perFrameStatistics.topRenderLayers).toEqual([{name: 'roads', durationMillis: 2}]);
    });

    test('does not return timings without the per-frame sampler', async () => {
        const collection = startCollection({samplingDurationMillis: 0});
        renderFrame(collection, 0, 10, () => timeLayer(collection, 'water', 0, 2));
        await deliveries();
        expect(collection.results[0].perFrameStatistics).toEqual(undefined);
    });
});
