'use strict';

const test = require('mapbox-gl-js-test').test;
const GeoJSONWorkerSource = require('../../../src/source/geojson_worker_source');
const StyleLayerIndex = require('../../../src/style/style_layer_index');

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
                source.removeSource({ source: 'source' });
                loadTile((vectorTile) => {
                    t.equal(vectorTile, null);
                    t.end();
                });
            });
        });
    });

    t.end();
});
