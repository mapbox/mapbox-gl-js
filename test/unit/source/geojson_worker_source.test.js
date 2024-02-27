import {describe, test, expect, vi} from "../../util/vitest.js";
import GeoJSONWorkerSource from '../../../src/source/geojson_worker_source.js';
import StyleLayerIndex from '../../../src/style/style_layer_index.js';
import {OverscaledTileID} from '../../../src/source/tile_id.js';
import perf from '../../../src/util/performance.js';
import {getProjection} from '../../../src/geo/projection/index.js';

const actor = {send: () => {}};

describe('reloadTile', () => {
    test('does not rebuild vector data unless data has changed', () => {
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
                expect(err).toEqual(null);
                callback();
            });
        }

        function reloadTile(callback) {
            source.reloadTile(tileParams, (err, data) => {
                expect(err).toEqual(null);
                return callback(data);
            });
        }

        addData(() => {
            // first call should load vector data from geojson
            let firstData;
            reloadTile(data => {
                firstData = data;
            });
            expect(loadVectorCallCount).toEqual(1);

            // second call won't give us new rawTileData
            reloadTile(data => {
                expect('rawTileData' in data).toBeFalsy();
                data.rawTileData = firstData.rawTileData;
                expect(data).toEqual(firstData);
            });

            // also shouldn't call loadVectorData again
            expect(loadVectorCallCount).toEqual(1);

            // replace geojson data
            addData(() => {
                // should call loadVectorData again after changing geojson data
                reloadTile(data => {
                    expect('rawTileData' in data).toBeTruthy();
                    expect(data).toEqual(firstData);
                });
                expect(loadVectorCallCount).toEqual(2);
            });
        });
    });
});

describe('resourceTiming', () => {
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

    test('loadData - url', () => {
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

        vi.spyOn(perf, 'getEntriesByName').mockImplementation(() => { return [ exampleResourceTiming ]; });

        const layerIndex = new StyleLayerIndex(layers);
        const source = new GeoJSONWorkerSource(actor, layerIndex, [], true, (params, callback) => { return callback(null, geoJson); });

        source.loadData({source: 'testSource', request: {url: 'http://localhost/nonexistent', collectResourceTiming: true}}, (err, result) => {
            expect(err).toEqual(null);
            expect(result.resourceTiming.testSource).toStrictEqual([ exampleResourceTiming ]); // got expected resource timing
        });
    });

    test('loadData - data', () => {
        const layerIndex = new StyleLayerIndex(layers);
        const source = new GeoJSONWorkerSource(actor, layerIndex, [], true);

        source.loadData({source: 'testSource', data: JSON.stringify(geoJson)}, (err, result) => {
            expect(err).toEqual(null);
            expect(result.resourceTiming).toEqual(undefined);
        });
    });
});
