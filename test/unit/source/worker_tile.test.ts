// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {test, expect, vi} from '../../util/vitest';
import WorkerTile from '../../../src/source/worker_tile';
import Wrapper from '../../../src/source/geojson_wrapper';
import {OverscaledTileID} from '../../../src/source/tile_id';
import StyleLayerIndex from '../../../src/style/style_layer_index';
import {getProjection} from '../../../src/geo/projection/index';

function createWorkerTile(params = {}) {
    return new WorkerTile({
        uid: '',
        zoom: 0,
        maxZoom: 20,
        tileSize: 512,
        source: 'source',
        tileID: new OverscaledTileID(1, 0, 1, 1, 1),
        overscaling: 1,
        projection: getProjection({name: 'mercator'}),
        brightness: 0,
        ...params
    });
}

function createWrapper() {
    return new Wrapper([{
        type: 1,
        geometry: [0, 0],
        tags: {}
    }]);
}

test('WorkerTile#parse', () => {
    const layerIndex = new StyleLayerIndex([{
        id: 'test',
        source: 'source',
        type: 'circle'
    }]);

    const tile = createWorkerTile();
    tile.parse(createWrapper(), layerIndex, [], [], {}, (err, result) => {
        expect(err).toBeFalsy();
        expect(result.buckets[0]).toBeTruthy();
    });
});

test('WorkerTile#parse skips hidden layers', () => {
    const layerIndex = new StyleLayerIndex([{
        id: 'test-hidden',
        source: 'source',
        type: 'fill',
        layout: {visibility: 'none'}
    }]);

    const tile = createWorkerTile();
    tile.parse(createWrapper(), layerIndex, [], [], {}, (err, result) => {
        expect(err).toBeFalsy();
        expect(result.buckets.length).toEqual(0);
    });
});

test('WorkerTile#parse skips layers without a corresponding source layer', () => {
    const layerIndex = new StyleLayerIndex([{
        id: 'test',
        source: 'source',
        'source-layer': 'nonesuch',
        type: 'fill'
    }]);

    const tile = createWorkerTile();
    tile.parse({layers: {}}, layerIndex, [], [], {}, (err, result) => {
        expect(err).toBeFalsy();
        expect(result.buckets.length).toEqual(0);
    });
});

test('WorkerTile#parse warns once when encountering a v1 vector tile layer', () => {
    const layerIndex = new StyleLayerIndex([{
        id: 'test',
        source: 'source',
        'source-layer': 'test',
        type: 'fill'
    }]);

    const data = {
        layers: {
            test: {
                version: 1
            }
        }
    };

    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const tile = createWorkerTile();
    tile.parse(data, layerIndex, [], [], {}, (err) => {
        expect(err).toBeFalsy();
        expect(console.warn.mock.calls[0][0]).toMatch(/does not use vector tile spec v2/);
    });
});

test('WorkerTile#parse adds $localized property and filters features based on the worldview', async () => {
    const vt = new Wrapper([
        {type: 1, geometry: [0, 0], tags: {worldview: 'all'}},
        {type: 1, geometry: [0, 0], tags: {worldview: 'CN'}},
        {type: 1, geometry: [0, 0], tags: {worldview: 'US,CN'}},
        {type: 1, geometry: [0, 0], tags: {worldview: 'JP,TR'}},
        {type: 1, geometry: [0, 0], tags: {worldview: 'US'}},
    ]);

    const bucketPopulateSpy = vi.fn();
    const layerIndex = new StyleLayerIndex([{id: '', source: 'source', type: 'symbol'}]);
    vi.spyOn(layerIndex.familiesBySource['source']['_geojsonTileLayer'][0][0], 'createBucket')
        .mockImplementation(() => ({
            populate: bucketPopulateSpy,
            isEmpty: () => false
        }));

    // no worldview
    // eslint-disable-next-line no-promise-executor-return
    await new Promise((resolve) => createWorkerTile({worldview: null}).parse(vt, layerIndex, [], [], {}, resolve));
    const allFeatures = bucketPopulateSpy.mock.lastCall[0];
    expect(allFeatures.length).toEqual(5);
    expect(allFeatures[0].feature.properties).toMatchObject({worldview: 'all'});
    expect(allFeatures[1].feature.properties).toMatchObject({worldview: 'CN'});
    expect(allFeatures[2].feature.properties).toMatchObject({worldview: 'US,CN'});
    expect(allFeatures[3].feature.properties).toMatchObject({worldview: 'JP,TR'});
    expect(allFeatures[4].feature.properties).toMatchObject({worldview: 'US'});

    // worldview: 'US'
    // eslint-disable-next-line no-promise-executor-return
    await new Promise((resolve) => createWorkerTile({worldview: 'US', localizableLayerIds: new Set(['_geojsonTileLayer'])}).parse(vt, layerIndex, [], [], {}, resolve));
    const usFeatures = bucketPopulateSpy.mock.lastCall[0];
    expect(usFeatures.length).toEqual(3);
    expect(usFeatures[0].feature.properties).toMatchObject({worldview: 'all', '$localized': true});
    expect(usFeatures[1].feature.properties).toMatchObject({worldview: 'US', '$localized': true});
    expect(usFeatures[2].feature.properties).toMatchObject({worldview: 'US', '$localized': true});
});
