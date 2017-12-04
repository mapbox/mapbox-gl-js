'use strict';

const test = require('mapbox-gl-js-test').test;
const GeoJSONWorkerSource = require('../../../src/source/geojson_worker_source');
const StyleLayerIndex = require('../../../src/style/style_layer_index');
const TileCoord = require('../../../src/source/tile_coord');

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
                coord: { x: 0, y: 0, z: 0 },
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
            coord: new TileCoord(0, 0, 0),
            maxZoom: 10
        };

        function addData(callback) {
            source.loadData({ source: 'sourceId', data: JSON.stringify(geoJson) }, (err) => {
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
