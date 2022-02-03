import {test} from '../../util/test.js';
import WorkerTile from '../../../src/source/worker_tile.js';
import Wrapper from '../../../src/source/geojson_wrapper.js';
import {OverscaledTileID} from '../../../src/source/tile_id.js';
import StyleLayerIndex from '../../../src/style/style_layer_index.js';
import {getProjection} from '../../../src/geo/projection/index.js';

function createWorkerTile() {
    return new WorkerTile({
        uid: '',
        zoom: 0,
        maxZoom: 20,
        tileSize: 512,
        source: 'source',
        tileID: new OverscaledTileID(1, 0, 1, 1, 1),
        overscaling: 1,
        projection: getProjection({name: 'mercator'})
    });
}

function createWrapper() {
    return new Wrapper([{
        type: 1,
        geometry: [0, 0],
        tags: {}
    }]);
}

test('WorkerTile#parse', (t) => {
    const layerIndex = new StyleLayerIndex([{
        id: 'test',
        source: 'source',
        type: 'circle'
    }]);

    const tile = createWorkerTile();
    tile.parse(createWrapper(), layerIndex, [], {}, (err, result) => {
        t.ifError(err);
        t.ok(result.buckets[0]);
        t.end();
    });
});

test('WorkerTile#parse skips hidden layers', (t) => {
    const layerIndex = new StyleLayerIndex([{
        id: 'test-hidden',
        source: 'source',
        type: 'fill',
        layout: {visibility: 'none'}
    }]);

    const tile = createWorkerTile();
    tile.parse(createWrapper(), layerIndex, [], {}, (err, result) => {
        t.ifError(err);
        t.equal(result.buckets.length, 0);
        t.end();
    });
});

test('WorkerTile#parse skips layers without a corresponding source layer', (t) => {
    const layerIndex = new StyleLayerIndex([{
        id: 'test',
        source: 'source',
        'source-layer': 'nonesuch',
        type: 'fill'
    }]);

    const tile = createWorkerTile();
    tile.parse({layers: {}}, layerIndex, [], {}, (err, result) => {
        t.ifError(err);
        t.equal(result.buckets.length, 0);
        t.end();
    });
});

test('WorkerTile#parse warns once when encountering a v1 vector tile layer', (t) => {
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

    t.stub(console, 'warn');

    const tile = createWorkerTile();
    tile.parse(data, layerIndex, [], {}, (err) => {
        t.ifError(err);
        t.ok(console.warn.calledWithMatch(/does not use vector tile spec v2/));
        t.end();
    });
});
