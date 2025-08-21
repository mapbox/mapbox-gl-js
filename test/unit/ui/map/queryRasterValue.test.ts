import {vi, describe, test, createMap, expect, doneAsync, waitFor} from '../../../util/vitest';
import {getPNGResponse, mockFetch} from '../../../util/network';
// @ts-expect-error Cannot find module
import tile from '../../../integration/tiles/mapboxsatellite.msm-precip-demo/0/0/0.mrt?arraybuffer';

describe('Map#queryRasterValue', () => {
    test('should fire error for empty source ID', async () => {
        const {withAsync, wait} = doneAsync();
        const map = createMap();

        map.once('error', withAsync((e, doneRef) => {
            expect(e.error.message).toBe(`IDs can't be empty.`);
            doneRef.resolve();
        }));

        vi.spyOn(map, 'queryRasterValue');
        await map.queryRasterValue(undefined, {lng: 0, lat: 0}, {bands: ['1000']});
        expect(map.queryRasterValue).toHaveResolvedWith(null);

        await wait;
    });

    test(`shouldn't allow access inner souces`, async () => {
        const {withAsync, wait} = doneAsync();
        const map = createMap();

        map.once('error', withAsync((e, doneRef) => {
            expect(e.error.message).toMatch(/IDs can't contain special symbols/);
            doneRef.resolve();
        }));

        vi.spyOn(map, 'queryRasterValue');
        await map.queryRasterValue('inner\u001Fbasemap', {lng: 0, lat: 0}, {bands: ['1000']});
        expect(map.queryRasterValue).toHaveResolvedWith(null);

        await wait;
    });

    test('should fire error for non raster-array source', async () => {
        mockFetch({
            'https://example.com/tiles/0/0/0.png': async () => new Response(await getPNGResponse())
        });
        const {withAsync, wait} = doneAsync();

        const sourceId = 'precipitations';

        const map = createMap({
            style: {
                version: 8,
                sources: {
                    [sourceId]: {
                        type: 'raster',
                        tiles: ['https://example.com/tiles/{z}/{x}/{y}.png'],
                    }
                },
                layers: [
                    {
                        'id': 'precipitations',
                        'source': sourceId,
                        'source-layer': "Total Precip",
                        'type': 'raster',
                    }
                ]
            }
        });

        await waitFor(map, 'load');

        map.once('error', withAsync((e, doneRef) => {
            expect(e.error.message).toBe(`queryRasterValue support only "raster-array" sources.`);
            doneRef.resolve();
        }));

        vi.spyOn(map, 'queryRasterValue');
        await map.queryRasterValue(sourceId, {lng: 0, lat: 0}, {layerName: 'Total Precip', bands: ['1000']});
        expect(map.queryRasterValue).toHaveResolvedWith(null);

        await wait;
    });

    test('should return raster array values', async () => {
        mockFetch({
            'https://example.com/tiles/0/0/0.mrt': async () => Promise.resolve(new Response(tile))
        });

        const map = createMap({
            style: {
                version: 8,
                sources: {
                    'precipitations': {
                        type: 'raster-array',
                        bounds: [
                            119.96875000000001,
                            22.38945074062084,
                            150.0418591469971,
                            47.624999999999986
                        ],
                        tiles: ['https://example.com/tiles/{z}/{x}/{y}.mrt']
                    }
                },
                layers: [
                    {
                        'id': 'precipitations',
                        'source': 'precipitations',
                        'source-layer': "Total Precip",
                        'type': 'raster',
                    }
                ]

            }
        });

        await waitFor(map, 'load');

        vi.spyOn(map, 'queryRasterValue');
        await map.queryRasterValue('precipitations', {
            lng: 129.88,
            lat: 35.53
        }, {bands: ['1708308000']});

        expect(map.queryRasterValue).toHaveResolvedWith({
            'Total Precip': {
                1708308000: [1.401490136981]
            },
        });
    });

    test('Should filter out by layer', async () => {
        mockFetch({
            'https://example.com/tiles/0/0/0.mrt': async () => Promise.resolve(new Response(tile))
        });

        const map = createMap({
            style: {
                version: 8,
                sources: {
                    'precipitations': {
                        type: 'raster-array',
                        bounds: [
                            119.96875000000001,
                            22.38945074062084,
                            150.0418591469971,
                            47.624999999999986
                        ],
                        tiles: ['https://example.com/tiles/{z}/{x}/{y}.mrt']
                    }
                },
                layers: [
                    {
                        'id': 'precipitations',
                        'source': 'precipitations',
                        'source-layer': "Total Precip",
                        'type': 'raster',
                    }
                ]

            }
        });

        await waitFor(map, 'load');

        vi.spyOn(map, 'queryRasterValue');
        await map.queryRasterValue('precipitations', {
            lng: 129.88,
            lat: 35.53
        }, {layerName: 'Some another', bands: ['1000']});

        expect(map.queryRasterValue).toHaveResolvedWith({});
    });

    test('should fire error for non-existing source', async () => {
        mockFetch({
            'https://example.com/tiles/0/0/0.mrt': async () => Promise.resolve(new Response(tile))
        });

        const {withAsync, wait} = doneAsync();

        const sourceId = 'precipitations-2';

        const map = createMap({
            style: {
                version: 8,
                sources: {
                    'precipitations': {
                        type: 'raster-array',
                        bounds: [
                            119.96875000000001,
                            22.38945074062084,
                            150.0418591469971,
                            47.624999999999986
                        ],
                        tiles: ['https://example.com/tiles/{z}/{x}/{y}.mrt']
                    }
                },
                layers: [
                    {
                        'id': 'precipitations',
                        'source': 'precipitations',
                        'source-layer': "Total Precip",
                        'type': 'raster',
                    }
                ]

            }
        });

        map.once('error', withAsync((e, doneRef) => {
            expect(e.error.message).toBe(`Source with id "${sourceId}" does not exist in the style.`);
            doneRef.resolve();
        }));

        await waitFor(map, 'load');

        vi.spyOn(map, 'queryRasterValue');
        await map.queryRasterValue(sourceId, {
            lng: 129.88,
            lat: 35.53
        }, {bands: ['1000']});
        expect(map.queryRasterValue).toHaveResolvedWith(null);

        await wait;
    });

    test('should filter out by band identifier', async () => {
        mockFetch({
            'https://example.com/tiles/0/0/0.mrt': async () => Promise.resolve(new Response(tile))
        });
        const map = createMap({
            style: {
                version: 8,
                sources: {
                    'precipitations': {
                        type: 'raster-array',
                        bounds: [
                            119.96875000000001,
                            22.38945074062084,
                            150.0418591469971,
                            47.624999999999986
                        ],
                        tiles: ['https://example.com/tiles/{z}/{x}/{y}.mrt']
                    }
                },
                layers: [
                    {
                        'id': 'precipitations',
                        'source': 'precipitations',
                        'source-layer': "Total Precip",
                        'type': 'raster',
                    }
                ]

            }
        });

        await waitFor(map, 'load');

        vi.spyOn(map, 'queryRasterValue');
        await map.queryRasterValue('precipitations', {
            lng: 129.88,
            lat: 35.53
        }, {bands: ['1708311600']});

        expect(map.queryRasterValue).toHaveResolvedWith({
            'Total Precip': {
                1708311600: [0.70149012655]
            }
        });
    });
});
