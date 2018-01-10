'use strict';

const test = require('mapbox-gl-js-test').test;
const GeoJSONWorkerSource = require('../../../src/source/geojson_worker_source');
const StyleLayerIndex = require('../../../src/style/style_layer_index');
const OverscaledTileID = require('../../../src/source/tile_id').OverscaledTileID;

test('removeSource', (t) => {
    t.test('removes the source from _geoJSONIndexes', (t) => {
        const source = new GeoJSONWorkerSource(null, new StyleLayerIndex());
        const geoJson = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [0, 0]
            }
        };

        function addData(callback) {
            source.loadData({ source: 'source', data: JSON.stringify(geoJson) }, (err) => {
                t.equal(err, null);
                callback();
            });
        }

        function loadTile(callback) {
            const loadVectorDataOpts = {
                source: 'source',
                tileID: new OverscaledTileID(0, 0, 0, 0, 0),
                maxZoom: 10
            };
            source.loadVectorData(loadVectorDataOpts, (err, vectorTile) => {
                t.equal(err, null);
                callback(vectorTile);
            });
        }

        addData(() => {
            loadTile((vectorTile) => {
                t.notEqual(vectorTile, null);
                source.removeSource({ source: 'source' }, (err, res) => {
                    t.false(err);
                    t.false(res);
                });
                loadTile((vectorTile) => {
                    t.equal(vectorTile, null);
                    t.end();
                });
            });
        });
    });

    t.end();
});

test('reloadTile', (t) => {
    t.test('does not rebuild vector data unless data has changed', (t) => {
        const layers = [
            {
                id: 'mylayer',
                source: 'sourceId',
                type: 'symbol',
            }
        ];
        const layerIndex = new StyleLayerIndex(layers);
        const source = new GeoJSONWorkerSource(null, layerIndex);
        const originalLoadVectorData = source.loadVectorData;
        let loadVectorCallCount = 0;
        source.loadVectorData = function(params, callback) {
            loadVectorCallCount++;
            return originalLoadVectorData.call(this, params, callback);
        };
        const geoJson = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [0, 0]
            }
        };
        const tileParams = {
            source: 'sourceId',
            uid: 0,
            tileID: new OverscaledTileID(0, 0, 0, 0, 0),
            maxZoom: 10
        };

        function addData(callback) {
            source.loadData({ source: 'sourceId', data: JSON.stringify(geoJson) }, (err) => {
                source.coalesce({ source: 'sourceId' });
                t.equal(err, null);
                callback();
            });
        }

        function reloadTile(callback) {
            source.reloadTile(tileParams, (err, data) => {
                t.equal(err, null);
                return callback(data);
            });
        }

        addData(() => {
            // first call should load vector data from geojson
            let firstData;
            reloadTile(data => {
                firstData = data;
            });
            t.equal(loadVectorCallCount, 1);

            // second call won't give us new rawTileData
            reloadTile(data => {
                t.notOk('rawTileData' in data);
                data.rawTileData = firstData.rawTileData;
                t.deepEqual(data, firstData);
            });

            // also shouldn't call loadVectorData again
            t.equal(loadVectorCallCount, 1);

            // replace geojson data
            addData(() => {
                // should call loadVectorData again after changing geojson data
                reloadTile(data => {
                    t.ok('rawTileData' in data);
                    t.deepEqual(data, firstData);
                });
                t.equal(loadVectorCallCount, 2);
                t.end();
            });
        });
    });

    t.end();
});


test('loadData', (t) => {
    const layers = [
        {
            id: 'layer1',
            source: 'source1',
            type: 'symbol',
        },
        {
            id: 'layer2',
            source: 'source2',
            type: 'symbol',
        }
    ];

    const geoJson = {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [0, 0]
        }
    };

    const layerIndex = new StyleLayerIndex(layers);
    function createWorker() {
        const worker = new GeoJSONWorkerSource(null, layerIndex);

        // Making the call to loadGeoJSON to asynchronous
        // allows these tests to mimic a message queue building up
        // (regardless of timing)
        const originalLoadGeoJSON = worker.loadGeoJSON;
        worker.loadGeoJSON = function(params, callback) {
            setTimeout(() => {
                originalLoadGeoJSON(params, callback);
            }, 0);
        };
        return worker;
    }

    t.test('abandons coalesced callbacks', (t) => {
        // Expect first call to run, second to be abandoned,
        // and third to run in response to coalesce
        const worker = createWorker();
        worker.loadData({ source: 'source1', data: JSON.stringify(geoJson) }, (err, abandoned) => {
            t.equal(err, null);
            t.notOk(abandoned);
            worker.coalesce({ source: 'source1' });
        });

        worker.loadData({ source: 'source1', data: JSON.stringify(geoJson) }, (err, abandoned) => {
            t.equal(err, null);
            t.ok(abandoned);
        });

        worker.loadData({ source: 'source1', data: JSON.stringify(geoJson) }, (err, abandoned) => {
            t.equal(err, null);
            t.notOk(abandoned);
            t.end();
        });
    });

    t.test('does not mix coalesce state between sources', (t) => {
        // Expect first and second calls to run independently,
        // and third call should run in response to coalesce
        // from first call.
        const worker = createWorker();
        worker.loadData({ source: 'source1', data: JSON.stringify(geoJson) }, (err, abandoned) => {
            t.equal(err, null);
            t.notOk(abandoned);
            worker.coalesce({ source: 'source1' });
        });

        worker.loadData({ source: 'source2', data: JSON.stringify(geoJson) }, (err, abandoned) => {
            t.equal(err, null);
            t.notOk(abandoned);
        });

        worker.loadData({ source: 'source1', data: JSON.stringify(geoJson) }, (err, abandoned) => {
            t.equal(err, null);
            t.notOk(abandoned);
            t.end();
        });
    });

    t.end();
});
