import {test} from '../../util/test.js';
import GeoJSONWorkerSource from '../../../src/source/geojson_worker_source.js';
import StyleLayerIndex from '../../../src/style/style_layer_index.js';
import {OverscaledTileID} from '../../../src/source/tile_id.js';
import perf from '../../../src/util/performance.js';
import {getProjection} from '../../../src/geo/projection/index.js';

const actor = {send: () => {}};

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
        const source = new GeoJSONWorkerSource(actor, layerIndex, [], true);
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
            maxZoom: 10,
            projection: getProjection({name: 'mercator'})
        };

        function addData(callback) {
            source.loadData({source: 'sourceId', data: JSON.stringify(geoJson)}, (err) => {
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

test('resourceTiming', (t) => {

    const layers = [
        {
            id: 'mylayer',
            source: 'sourceId',
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

    t.test('loadData - url', (t) => {
        const exampleResourceTiming = {
            connectEnd: 473,
            connectStart: 473,
            decodedBodySize: 86494,
            domainLookupEnd: 473,
            domainLookupStart: 473,
            duration: 341,
            encodedBodySize: 52528,
            entryType: "resource",
            fetchStart: 473.5,
            initiatorType: "xmlhttprequest",
            name: "http://localhost:2900/fake.geojson",
            nextHopProtocol: "http/1.1",
            redirectEnd: 0,
            redirectStart: 0,
            requestStart: 477,
            responseEnd: 815,
            responseStart: 672,
            secureConnectionStart: 0
        };

        t.stub(perf, 'getEntriesByName').callsFake(() => { return [ exampleResourceTiming ]; });

        const layerIndex = new StyleLayerIndex(layers);
        const source = new GeoJSONWorkerSource(actor, layerIndex, [], true, (params, callback) => { return callback(null, geoJson); });

        source.loadData({source: 'testSource', request: {url: 'http://localhost/nonexistent', collectResourceTiming: true}}, (err, result) => {
            t.equal(err, null);
            t.deepEquals(result.resourceTiming.testSource, [ exampleResourceTiming ], 'got expected resource timing');
            t.end();
        });
    });

    t.test('loadData - data', (t) => {
        const layerIndex = new StyleLayerIndex(layers);
        const source = new GeoJSONWorkerSource(actor, layerIndex, [], true);

        source.loadData({source: 'testSource', data: JSON.stringify(geoJson)}, (err, result) => {
            t.equal(err, null);
            t.equal(result.resourceTiming, undefined, 'no resourceTiming property when loadData is not sent a URL');
            t.end();
        });
    });

    t.end();
});
