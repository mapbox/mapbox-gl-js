// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect, vi} from '../../util/vitest';
import GeoJSONWorkerSource from '../../../src/source/geojson_worker_source';
import StyleLayerIndex from '../../../src/style/style_layer_index';
import {OverscaledTileID} from '../../../src/source/tile_id';
import perf from '../../../src/util/performance';
import {getProjection} from '../../../src/geo/projection/index';

const actor = {send: () => {}};

describe('reloadTile', () => {
    test('does not rebuild vector data unless data has changed', async () => {
        const layers = [
            {
                id: 'mylayer',
                source: 'sourceId',
                type: 'symbol',
            }
        ];
        const layerIndex = new StyleLayerIndex(layers);
        const source = new GeoJSONWorkerSource({actor, layerIndex, availableImages: [], availableModels: [], isSpriteLoaded: true});
        const originalLoadVectorData = source.loadVectorData;
        let loadVectorCallCount = 0;
        source.loadVectorData = function (params, callback) {
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

        await source.loadData({source: 'sourceId', data: JSON.stringify(geoJson)});

        // first call should load vector data from geojson
        const firstData = await source.reloadTile(tileParams);
        expect(loadVectorCallCount).toEqual(1);

        // second call won't give us new rawTileData or headers (no network request)
        const secondData = await source.reloadTile(tileParams);
        expect('rawTileData' in secondData).toBeFalsy();
        secondData.rawTileData = firstData.rawTileData;
        secondData.headers = firstData.headers;
        expect(secondData).toEqual(firstData);

        // also shouldn't call loadVectorData again
        expect(loadVectorCallCount).toEqual(1);

        // replace geojson data
        await source.loadData({source: 'sourceId', data: JSON.stringify(geoJson)});

        // should call loadVectorData again after changing geojson data
        const thirdData = await source.reloadTile(tileParams);
        expect('rawTileData' in thirdData).toBeTruthy();
        expect(thirdData).toEqual(firstData);
        expect(loadVectorCallCount).toEqual(2);
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

    test('loadData - url', async () => {
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

        vi.spyOn(perf, 'getEntriesByName').mockImplementation(() => { return [exampleResourceTiming]; });

        const layerIndex = new StyleLayerIndex(layers);
        const source = new GeoJSONWorkerSource({actor, layerIndex, availableImages: [], availableModels: [], isSpriteLoaded: true});
        source.loadGeoJSON = (params, callback) => { return callback(null, geoJson); };

        const result = await source.loadData({source: 'testSource', request: {url: 'http://localhost/nonexistent', collectResourceTiming: true}});
        expect(result.resourceTiming.testSource).toStrictEqual([exampleResourceTiming]); // got expected resource timing
    });

    test('loadData - data', async () => {
        const layerIndex = new StyleLayerIndex(layers);
        const source = new GeoJSONWorkerSource({actor, layerIndex, availableImages: [], availableModels: [], isSpriteLoaded: true});

        const result = await source.loadData({source: 'testSource', data: JSON.stringify(geoJson)});
        expect(result.resourceTiming).toEqual(undefined);
    });
});
