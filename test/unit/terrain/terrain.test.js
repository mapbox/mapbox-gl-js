import {describe, test, beforeAll, beforeEach, afterEach, afterAll, expect, waitFor, vi, createMap} from "../../util/vitest.js";
import {getNetworkWorker, http, HttpResponse, getPNGResponse} from '../../util/network.js';
import {extend} from '../../../src/util/util.js';
import DEMData from '../../../src/data/dem_data.js';
import {RGBAImage} from '../../../src/util/image.js';
import MercatorCoordinate, {MAX_MERCATOR_LATITUDE} from '../../../src/geo/mercator_coordinate.js';
import {OverscaledTileID} from '../../../src/source/tile_id.js';
import styleSpec from '../../../src/style-spec/reference/latest.js';
import Terrain from '../../../src/style/terrain.js';
import Tile from '../../../src/source/tile.js';
import {VertexMorphing} from '../../../src/terrain/draw_terrain_raster.js';
import {fixedLngLat, fixedCoord, fixedPoint} from '../../util/fixed.js';
import Point from '@mapbox/point-geometry';
import LngLat from '../../../src/geo/lng_lat.js';
import Marker from '../../../src/ui/marker.js';
import Popup from '../../../src/ui/popup.js';
import simulate from '../../util/simulate_interaction.js';
import browser from '../../../src/util/browser.js';
import * as DOM from '../../../src/util/dom.js';
import {Map, AVERAGE_ELEVATION_SAMPLING_INTERVAL, AVERAGE_ELEVATION_EASE_TIME} from '../../../src/ui/map.js';
import {createConstElevationDEM, setMockElevationTerrain} from '../../util/dem_mock.js';
// eslint-disable-next-line import/no-unresolved
import vectorStub from '../../util/fixtures/10/301/384.pbf?arraybuffer';

function createStyle() {
    return {
        version: 8,
        center: [180, 0],
        zoom: 14,
        sources: {},
        layers: []
    };
}

const TILE_SIZE = 128;
const zeroDem = createConstElevationDEM(0, TILE_SIZE);

const createGradientDEM = () => {
    const pixels = new Uint8Array((TILE_SIZE + 2) * (TILE_SIZE + 2) * 4);
    // 1, 134, 160 encodes 0m.
    const word = [1, 134, 160];
    for (let j = 1; j < TILE_SIZE + 1; j++) {
        for (let i = 1; i < TILE_SIZE + 1; i++) {
            const index = (j * (TILE_SIZE + 2) + i) * 4;
            pixels[index] = word[0];
            pixels[index + 1] = word[1];
            pixels[index + 2] = word[2];
            // Increment word for next pixel.
            word[2] += 1;
            if (word[2] === 256) {
                word[2] = 0;
                word[1] += 1;
            }
            if (word[1] === 256) {
                word[1] = 0;
                word[0] += 1;
            }
        }
    }
    return new DEMData(0, new RGBAImage({height: TILE_SIZE + 2, width: TILE_SIZE + 2}, pixels), "mapbox");
};

const createNegativeGradientDEM = () => {
    const pixels = new Uint8Array((TILE_SIZE + 2) * (TILE_SIZE + 2) * 4);
    // 1, 134, 160 encodes 0m.
    const word = [1, 134, 160];
    for (let j = 1; j < TILE_SIZE + 1; j++) {
        for (let i = 1; i < TILE_SIZE + 1; i++) {
            const index = (j * (TILE_SIZE + 2) + i) * 4;
            pixels[index] = word[0];
            pixels[index + 1] = word[1];
            pixels[index + 2] = word[2];
            // Decrement word for next pixel.
            word[2] -= 1;
            if (word[2] === 0) {
                word[2] = 256;
                word[1] -= 1;
            }
            if (word[1] === 0) {
                word[1] = 256;
                word[0] -= 1;
            }
        }
    }
    return new DEMData(0, new RGBAImage({height: TILE_SIZE + 2, width: TILE_SIZE + 2}, pixels), "mapbox");
};

let networkWorker;

beforeAll(async () => {
    networkWorker = await getNetworkWorker(window);
});

afterEach(() => {
    networkWorker.resetHandlers();
});

afterAll(() => {
    networkWorker.stop();
});

describe('Elevation', () => {
    const dem = createGradientDEM();

    describe('elevation sampling', () => {
        let map;

        beforeAll(async () => {
            map = createMap();
            await waitFor(map, 'style.load');
            setMockElevationTerrain(map, zeroDem, TILE_SIZE);
            await waitFor(map, 'render');
        });

        const elevationError = -1;

        test('Sample', () => {
            const elevation = map.painter.terrain.getAtPoint({x: 0.51, y: 0.49}, elevationError);
            expect(elevation).toEqual(0);
        });

        test('Invalid sample position', () => {
            const elevation1 = map.painter.terrain.getAtPoint({x: 0.5, y: 1.1}, elevationError);
            const elevation2 = map.painter.terrain.getAtPoint({x: 1.15, y: -0.001}, elevationError);
            expect(elevation1).toEqual(elevationError);
            expect(elevation2).toEqual(elevationError);
        });
    });

    describe('Out of bounds when sampling 514x514 tile', () => {
        let map;

        beforeAll(async () => {
            map = createMap({zoom: 15.1, center:[11.594417, 48.095821]});
            await waitFor(map, 'style.load');
            setMockElevationTerrain(map, zeroDem, 512, 11);
            await waitFor(map, 'render');
        });

        test('Sample', () => {
            const points = [[8191, 8191, 1]];
            map.painter.terrain.getForTilePoints(new OverscaledTileID(15, 0, 15, 17439, 11377), points);
            expect(points[0][2]).toEqual(0);
        });
    });

    test('style diff / remove dem source cache', () => {
        let map;

        beforeAll(async () => {
            map = createMap();
            await waitFor(map, 'style.load');
            setMockElevationTerrain(map, zeroDem, TILE_SIZE);
            await waitFor(map, 'render');
        });

        describe('Throws error if style update tries to remove terrain DEM source', () => {
            test('remove source', () => {
                const stub = vi.spyOn(console, 'error');
                map.removeSource('mapbox-dem');
                expect(stub.calledOnce).toBeTruthy();
            });
        });
    });

    test('style diff=false removes dem source', async () => {
        const map = createMap();
        await waitFor(map, "style.load");
        setMockElevationTerrain(map, zeroDem, TILE_SIZE);
        await waitFor(map, "render");
        map._updateTerrain();
        const elevationError = -1;
        const terrain = map.painter.terrain;
        const elevation1 = map.painter.terrain.getAtPoint({x: 0.5, y: 0.5}, elevationError);
        expect(elevation1).toEqual(0);

        map.setStyle(createStyle(), {diff: false});

        const elevation2 = terrain.getAtPoint({x: 0.5, y: 0.5}, elevationError);
        expect(elevation2).toEqual(elevationError);
    });

    describe('interpolation', () => {
        let map, cache, dx, coord;

        beforeEach(() => {
            networkWorker.use(
                ...[
                    'http://example.com/10/1023/511.png',
                    'http://example.com/10/0/511.png',
                    'http://example.com/10/0/512.png',
                    'http://example.com/10/1023/512.png'
                ].map(path => {
                    return http.get(path, async () => {
                        return new HttpResponse(vectorStub);
                    });
                })
            );
        });

        beforeAll(async () => {
            map = createMap({
                style: extend(createStyle(), {
                    sources: {
                        mapbox: {
                            type: 'vector',
                            minzoom: 1,
                            maxzoom: 10,
                            tiles: ['http://example.com/{z}/{x}/{y}.png']
                        }
                    },
                    layers: [{
                        id: 'layerId1',
                        type: 'circle',
                        source: 'mapbox',
                        'source-layer': 'sourceLayer'
                    }]
                })
            });

            await waitFor(map, 'style.load');

            map.addSource('mapbox-dem', {
                "type": "raster-dem",
                "tiles": ['http://example.com/{z}/{x}/{y}.png'],
                "tileSize": TILE_SIZE,
                "maxzoom": 14
            });

            cache = map.style.getOwnSourceCache('mapbox-dem');
            cache.used = cache._sourceLoaded = true;
            cache._loadTile = (tile, callback) => {
                tile.dem = dem;
                tile.needsHillshadePrepare = true;
                tile.needsDEMTextureUpload = true;
                tile.state = 'loaded';
                callback(null);
            };
            map.setTerrain({"source": "mapbox-dem"});
            await waitFor(map, 'render');
            cache = map.style.getOwnSourceCache('mapbox-dem');

            const tilesAtTileZoom = 1 << 14;
            // Calculate offset to neighbor value in dem bitmap.
            dx = 1 / (tilesAtTileZoom * TILE_SIZE);

            coord = MercatorCoordinate.fromLngLat({lng: 180, lat: 0});
        });

        test('terrain tiles loaded wrap', () => {
            const tile = cache.getTile(new OverscaledTileID(14, 1, 14, 0, 8192));
            expect(tile.dem).toBeTruthy();
        });

        test('terrain tiles loaded no wrap', () => {
            const tile = cache.getTile(new OverscaledTileID(14, 0, 14, 16383, 8192));
            expect(tile.dem).toBeTruthy();
        });

        test('terrain at coord should be 0', () => {
            expect(map.painter.terrain.getAtPoint(coord)).toEqual(0);
        });

        test('dx', () => {
            const elevationDx = map.painter.terrain.getAtPoint({x: coord.x + dx, y: coord.y}, 0);
            expect(Math.abs(elevationDx - 0.1) < 1e-8).toBeTruthy();
        });

        test('dy', () => {
            const elevationDy = map.painter.terrain.getAtPoint({x: coord.x, y: coord.y + dx}, 0);
            const expectation = TILE_SIZE * 0.1;
            expect(Math.abs(elevationDy - expectation) < 1e-6).toBeTruthy();
        });

        test('dx/3 dy/3', () => {
            const elevation = map.painter.terrain.getAtPoint({x: coord.x + dx / 3, y: coord.y + dx / 3}, 0);
            const expectation = (2 * TILE_SIZE + 2) * 0.1 / 6;
            expect(Math.abs(elevation - expectation) < 1e-9).toBeTruthy();
        });

        test('-dx -wrap', () => {
            const elevation = map.painter.terrain.getAtPoint({x: coord.x - dx, y: coord.y}, 0);
            const expectation = (TILE_SIZE - 1) * 0.1;
            expect(Math.abs(elevation - expectation) < 1e-6).toBeTruthy();
        });

        test('-1.5dx -wrap', () => {
            const elevation = map.painter.terrain.getAtPoint({x: coord.x - 1.5 * dx, y: coord.y}, 0);
            const expectation = (TILE_SIZE - 1.5) * 0.1;
            expect(Math.abs(elevation - expectation) < 1e-7).toBeTruthy();
        });

        test('disable terrain', async () => {
            expect(map.painter.terrain).toBeTruthy();
            map.setTerrain(null);
            await waitFor(map, "render");
            expect(map.painter.terrain).toBeFalsy();
            await waitFor(map, "idle");
        });
    });

    describe('elevation.isDataAvailableAtPoint', () => {
        let map;
        beforeAll(async () => {
            map = createMap();
            await waitFor(map, 'style.load');
            map.addSource('mapbox-dem', {
                "type": "raster-dem",
                "tiles": ['http://example.com/{z}/{x}/{y}.png'],
                TILE_SIZE,
                "maxzoom": 14
            });
            map.setTerrain({"source": "mapbox-dem"});
            await waitFor(map, 'render');
        });

        test('Sample before loading DEMs', () => {
            expect(map.painter.terrain.isDataAvailableAtPoint({x: 0.5, y: 0.5})).toBeFalsy();
        });

        test('Sample within after loading', async () => {
            const cache = map.style.getOwnSourceCache('mapbox-dem');
            cache.used = cache._sourceLoaded = true;
            cache._loadTile = (tile, callback) => {
                tile.dem = zeroDem;
                tile.needsHillshadePrepare = true;
                tile.needsDEMTextureUpload = true;
                tile.state = 'loaded';
                callback(null);
            };
            await waitFor(map, 'render');
            expect(map.painter.terrain.isDataAvailableAtPoint({x: 0.5, y: 0.5})).toBeTruthy();
        });

        test('Sample outside after loading', () => {
            expect(map.painter.terrain.getAtPoint({x: 0.5, y: 1.1})).toBeFalsy();
            expect(map.painter.terrain.getAtPoint({x: 1.15, y: -0.001})).toBeFalsy();
        });
    });

    test('map._updateAverageElevation', async () => {
        const map = createMap({
            style: extend(createStyle(), {
                layers: [{
                    "id": "background",
                    "type": "background",
                    "paint": {
                        "background-color": "black"
                    }
                }]
            })
        });
        map.setPitch(85);
        map.setZoom(12);

        await waitFor(map, "style.load");
        map.addSource('mapbox-dem', {
            "type": "raster-dem",
            "tiles": ['http://example.com/{z}/{x}/{y}.png'],
            "tileSize": TILE_SIZE,
            "maxzoom": 14
        });
        const cache = map.style.getOwnSourceCache('mapbox-dem');
        cache.used = cache._sourceLoaded = true;
        cache._loadTile = (tile, callback) => {
            // Elevate tiles above center.
            tile.dem = createGradientDEM();
            tile.state = 'loaded';
            callback(null);
        };
        map.setTerrain({"source": "mapbox-dem"});
        expect(map.transform.averageElevation).toEqual(0);

        await waitFor(map, "render");
        map._updateTerrain();
        map._isInitialLoad = false;

        expect(map.painter.averageElevationNeedsEasing()).toBeFalsy();

        map.setFog({});
        map.setPitch(85);
        expect(map.painter.averageElevationNeedsEasing()).toBeTruthy();

        let changed;
        let timestamp;

        timestamp = browser.now();
        changed = map._updateAverageElevation(timestamp);
        expect(changed).toBeFalsy();
        expect(map._averageElevation.isEasing(timestamp)).toBeFalsy();
        expect(map.transform.averageElevation).toEqual(0);

        timestamp += AVERAGE_ELEVATION_SAMPLING_INTERVAL;
        changed = map._updateAverageElevation(timestamp);
        expect(changed).toBeFalsy();
        expect(map._averageElevation.isEasing(timestamp)).toBeFalsy();
        expect(map.transform.averageElevation).toEqual(0);

        map.setZoom(13);
        map.setPitch(70);
        map.setCenter([map.getCenter().lng + 0.01, map.getCenter().lat]);

        timestamp += AVERAGE_ELEVATION_SAMPLING_INTERVAL;
        changed = map._updateAverageElevation(timestamp);
        expect(changed).toBeTruthy();
        expect(map._averageElevation.isEasing(timestamp)).toBeTruthy();
        expect(map.transform.averageElevation).toEqual(0);

        const assertAlmostEqual = (actual, expected, epsilon = 1e-3) => {
            expect(Math.abs(actual - expected) < epsilon).toBeTruthy();
        };

        timestamp += AVERAGE_ELEVATION_EASE_TIME * 0.5;
        changed = map._updateAverageElevation(timestamp);
        expect(changed).toBeTruthy();
        expect(map._averageElevation.isEasing(timestamp)).toBeTruthy();
        assertAlmostEqual(map.transform.averageElevation, 797.6258610429736);

        timestamp += AVERAGE_ELEVATION_EASE_TIME * 0.5;
        changed = map._updateAverageElevation(timestamp);
        expect(changed).toBeTruthy();
        expect(map._averageElevation.isEasing(timestamp)).toBeTruthy();
        assertAlmostEqual(map.transform.averageElevation, 1595.2517220859472);

        timestamp += AVERAGE_ELEVATION_SAMPLING_INTERVAL;
        changed = map._updateAverageElevation(timestamp);
        expect(changed).toBeFalsy();
        expect(map._averageElevation.isEasing(timestamp)).toBeFalsy();
        assertAlmostEqual(map.transform.averageElevation, 1595.2517220859472);
    });

    test('mapbox-gl-js-internal#91', () => {
        const data = {
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "properties": {},
                "geometry": {
                    "type": "LineString",
                    "coordinates": []
                }
            }]
        };
        const map = createMap({
            style: extend(createStyle(), {
                projection: {
                    name: 'mercator'
                },
                sources: {
                    trace: {
                        type: 'geojson',
                        data
                    }
                },
                layers: [{
                    "id": "background",
                    "type": "background",
                    "paint": {
                        "background-color": "black"
                    }
                }, {
                    'id': 'trace',
                    'type': 'line',
                    'source': 'trace',
                    'paint': {
                        'line-color': "red",
                        'line-width': 5,
                        'line-opacity': 1
                    }
                }]
            })
        });
        map.on('style.load', () => {
            setMockElevationTerrain(map, zeroDem, TILE_SIZE);
            const source = map.getSource('trace');
            data.features[0].geometry.coordinates = [
                [180, 0],
                [180.1, 0],
                [180.2, 0.1]
            ];
            source.setData(data);
            expect(source.loaded()).toEqual(false);
            const onLoaded = (e) => {
                if (e.sourceDataType === 'visibility') return;
                source.off('data', onLoaded);
                expect(map.getSource('trace').loaded()).toEqual(true);
                let beganRenderingContent = false;
                map.on('render', () => {
                    const gl = map.painter.context.gl;
                    const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
                    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
                    const centerOffset = map._containerWidth / 2 * (map._containerHeight + 1) * 4;
                    const isCenterRendered = pixels[centerOffset] === 255;
                    if (!beganRenderingContent) {
                        beganRenderingContent = isCenterRendered;
                        if (beganRenderingContent) {
                            data.features[0].geometry.coordinates.push([180.1, 0.1]);
                            source.setData(data);
                            expect(map.getSource('trace').loaded()).toEqual(false);
                        }
                    } else {
                        // Previous trace data should be rendered while loading update.
                        expect(isCenterRendered).toBeTruthy();
                        setTimeout(() => map.remove(), 0); // avoids re-triggering render after t.end. Don't remove while in render().
                    }
                });
            };
            source.on('data', onLoaded);
        });
    });

    describe('mapbox-gl-js-internal#281', () => {
        let map;

        beforeAll(async () => {
            const data = {
                "type": "FeatureCollection",
                "features": [{
                    "type": "Feature",
                    "properties": {},
                    "geometry": {
                        "type": "LineString",
                        "coordinates": []
                    }
                }]
            };
            map = createMap({
                style: {
                    version: 8,
                    center: [85, 85],
                    zoom: 2.1,
                    sources: {
                        mapbox: {
                            type: 'vector',
                            minzoom: 1,
                            maxzoom: 10,
                            tiles: ['http://example.com/{z}/{x}/{y}.png']
                        },
                        'mapbox-dem': {
                            type: "raster-dem",
                            tiles: ['http://example.com/{z}/{x}/{y}.png'],
                            tileSize: 512,
                            maxzoom: 14
                        }
                    },
                    layers: [{
                        "id": "background",
                        "type": "background",
                        "paint": {
                            "background-color": "black"
                        }
                    }]
                }
            });

            await new Promise(resolve => {
                map.on('style.load', () => {
                    map.addSource('trace', {type: 'geojson', data});
                    map.addLayer({
                        'id': 'trace',
                        'type': 'line',
                        'source': 'trace',
                        'paint': {
                            'line-color': 'yellow',
                            'line-opacity': 0.75,
                            'line-width': 5
                        }
                    });
                    const cache = map.style.getOwnSourceCache('mapbox-dem');
                    cache._loadTile = (tile, callback) => {
                        const pixels = new Uint8Array((512 + 2) * (512 + 2) * 4);
                        tile.dem = new DEMData(0, new RGBAImage({height: 512 + 2, width: 512 + 2}, pixels));
                        tile.needsHillshadePrepare = true;
                        tile.needsDEMTextureUpload = true;
                        tile.state = 'loaded';
                        callback(null);
                    };
                    cache.used = cache._sourceLoaded = true;
                    map.setTerrain({"source": "mapbox-dem"});
                    map.once('render', () => {
                        map._updateTerrain();
                        map.painter.style.on('data', (event) => {
                            if (event.sourceCacheId === 'other:trace') {
                                resolve();
                            }
                        });
                        const cache = map.style.getOwnSourceCache('trace');
                        cache.transform = map.painter.transform;
                        cache._addTile(new OverscaledTileID(0, 0, 0, 0, 0));
                        cache.onAdd();
                        cache.reload();
                        cache.used = cache._sourceLoaded = true;
                    });
                });
            });
        });

        test('Source other:trace is cleared from cache', () => {
            expect(map.painter.terrain._tilesDirty.hasOwnProperty('other:trace')).toBeTruthy();
            expect(map.painter.terrain._tilesDirty['other:trace']['0']).toBeTruthy();
        });
    });

    test('mapbox-gl-js-internal#349', async () => {
        networkWorker.use(
            http.get('http://example.com/0/0/0.png', async () => {
                return new HttpResponse(await getPNGResponse());
            })
        );

        const map = createMap({
            style: {
                version: 8,
                center: [85, 85],
                zoom: 2.1,
                sources: {
                    'mapbox-dem': {
                        type: "raster-dem",
                        tiles: ['http://example.com/{z}/{x}/{y}.png'],
                        tileSize: 512,
                        maxzoom: 14
                    }
                },
                layers: [{
                    "id": "background",
                    "type": "background",
                    "paint": {
                        "background-color": "black"
                    }
                }]
            }
        });
        await waitFor(map, "style.load");
        const customLayer = {
            id: 'custom',
            type: 'custom',
            onAdd: () => {},
            render: () => {}
        };
        map.addLayer(customLayer);
        map.setTerrain({"source": "mapbox-dem"});
        await waitFor(map, "render");
        expect(map.painter.terrain._shouldDisableRenderCache()).toBeFalsy();
        await waitFor(map, "idle");
    });

    describe('mapbox-gl-js-internal#32', () => {
        let map, tr;
        beforeAll(async () => {
            map = createMap({
                style: {
                    version: 8,
                    center: [85, 85],
                    zoom: 2.1,
                    sources: {
                        mapbox: {
                            type: 'vector',
                            minzoom: 1,
                            maxzoom: 10,
                            tiles: ['http://example.com/{z}/{x}/{y}.png']
                        },
                        'mapbox-dem': {
                            type: "raster-dem",
                            tiles: ['http://example.com/{z}/{x}/{y}.png'],
                            tileSize: 512,
                            maxzoom: 14
                        }
                    },
                    layers: [{
                        id: 'layerId1',
                        type: 'circle',
                        source: 'mapbox',
                        'source-layer': 'sourceLayer'
                    }]
                }
            });

            await new Promise(resolve => {
                map.on('style.load', () => {
                    const cache = map.style.getOwnSourceCache('mapbox-dem');
                    cache._loadTile = (tile, callback) => {
                        const pixels = new Uint8Array((512 + 2) * (512 + 2) * 4);
                        tile.dem = new DEMData(0, new RGBAImage({height: 512 + 2, width: 512 + 2}, pixels));
                        tile.needsHillshadePrepare = true;
                        tile.needsDEMTextureUpload = true;
                        tile.state = 'loaded';
                        callback(null);
                    };
                    cache.used = cache._sourceLoaded = true;
                    tr = map.painter.transform.clone();
                    map.setTerrain({"source": "mapbox-dem"});
                    map.once('render', () => {
                        map._updateTerrain();
                        resolve();
                    });
                });
            });
        });

        test('center is not further constrained', () => {
            expect(tr.center).toEqual(map.painter.transform.center);
        });
    });
});

const spec = styleSpec.terrain;

describe('Terrain style', () => {
    test('Terrain defaults', () => {
        const terrain = new Terrain({});
        terrain.recalculate({zoom: 0});

        expect(terrain.properties.get('source')).toEqual(spec.source.default);
        expect(terrain.properties.get('exaggeration')).toEqual(spec.exaggeration.default);
    });

    test('Exaggeration with stops function', () => {
        const terrain = new Terrain({
            source: "dem",
            exaggeration: {
                stops: [[15, 0.2], [17, 0.8]]
            }
        });
        terrain.recalculate({zoom: 16});

        expect(terrain.properties.get('exaggeration')).toEqual(0.5);
    });
});

function nearlyEquals(a, b, eps = 0.000000001) {
    return Object.keys(a).length >= 2 && Object.keys(a).every(key => Math.abs(a[key] - b[key]) < eps);
}

test('Raycast projection 2D/3D', async () => {
    const map = createMap({
        style: {
            version: 8,
            center: [0, 0],
            zoom: 14,
            sources: {},
            layers: [{
                "id": "background",
                "type": "background",
                "paint": {
                    "background-color": "black"
                }
            }],
            pitch: 80
        }
    });

    await waitFor(map, 'style.load');

    setMockElevationTerrain(map, zeroDem, TILE_SIZE);

    await waitFor(map, 'render');
    map._updateTerrain();

    const transform = map.transform;
    const cx = transform.width / 2;
    const cy = transform.height / 2;
    expect(fixedLngLat(transform.pointLocation(new Point(cx, cy)))).toEqual({lng: 0, lat: 0});
    expect(fixedCoord(transform.pointCoordinate(new Point(cx, cy)))).toEqual({x: 0.5, y: 0.5, z: 0});
    expect(nearlyEquals(fixedPoint(transform.locationPoint(new LngLat(0, 0))), {x: cx, y: cy})).toBeTruthy();
    // Lower precision as we are raycasting using GPU depth render.
    expect(nearlyEquals(fixedLngLat(transform.pointLocation3D(new Point(cx, cy))), {lng: 0, lat: 0}, 0.00006)).toBeTruthy();
    expect(nearlyEquals(fixedCoord(transform.pointCoordinate3D(new Point(cx, cy))), {x: 0.5, y: 0.5, z: 0}, 0.000001)).toBeTruthy();
    expect(nearlyEquals(fixedPoint(transform.locationPoint3D(new LngLat(0, 0))), {x: cx, y: cy})).toBeTruthy();

    // above horizon:
    const skyPoint = new Point(cx, 0);
    // raycast implementation returns null as there is no point at the top.
    expect(transform.elevation.pointCoordinate(skyPoint)).toEqual(null);

    expect(transform.elevation.pointCoordinate(new Point(transform.width, transform.height))).toBeTruthy();
    expect(transform.elevation.pointCoordinate(new Point(transform.width, transform.height))[2].toFixed(10)).toEqual('-0.0000000000');

    const coord2D = transform.pointCoordinate(skyPoint);
    const coord3D = transform.pointCoordinate3D(skyPoint);
    expect(nearlyEquals(coord2D, coord3D, 0.001)).toBeTruthy();

    // Screen points above horizon line should return locations on the horizon line.
    const latLng3D = transform.pointLocation3D(skyPoint);
    const latLng2D = transform.pointLocation(skyPoint);

    expect(latLng2D.lng).toBe(latLng3D.lng);
    // Small differences in screen position, close to the horizon, becomes a large distance in latitude.
    expect(latLng2D.lat.toFixed(0)).toBe(latLng3D.lat.toFixed(0));

    const horizonPoint3D = transform.locationPoint3D(latLng3D);
    const horizonPoint2D = transform.locationPoint(latLng2D);

    expect(horizonPoint3D.x.toFixed(7)).toEqual(cx.toFixed(7));
    expect(horizonPoint2D.x.toFixed(7)).toBe(cx.toFixed(7));
    expect(horizonPoint2D.x.toFixed(7)).toBe(horizonPoint3D.x.toFixed(7));

    expect(transform.horizonLineFromTop()).toBe(52.39171520871443);
    expect(horizonPoint2D.y.toFixed(7)).toBe(transform.horizonLineFromTop().toFixed(7));
    expect((horizonPoint2D.y / 10).toFixed(0)).toBe((horizonPoint3D.y / 10).toFixed(0));

    // disable terrain.
    map.setTerrain(null);

    await waitFor(map, 'render');
    expect(map.painter.terrain).toBeFalsy();
    const latLng = transform.pointLocation3D(skyPoint);
    expect(latLng).toStrictEqual(latLng2D);

    expect(fixedLngLat(transform.pointLocation(new Point(cx, cy)))).toEqual({lng: 0, lat: 0});
    expect(fixedCoord(transform.pointCoordinate(new Point(cx, cy)))).toEqual({x: 0.5, y: 0.5, z: 0});
    expect(nearlyEquals(fixedPoint(transform.locationPoint(new LngLat(0, 0))), {x: cx, y: cy})).toBeTruthy();
    // Higher precision as we are using the same as for 2D, given there is no terrain.
    expect(nearlyEquals(fixedLngLat(transform.pointLocation3D(new Point(cx, cy))), {lng: 0, lat: 0})).toBeTruthy();
    expect(nearlyEquals(fixedCoord(transform.pointCoordinate3D(new Point(cx, cy))), {x: 0.5, y: 0.5, z: 0})).toBeTruthy();
    expect(nearlyEquals(fixedPoint(transform.locationPoint3D(new LngLat(0, 0))), {x: cx, y: cy})).toBeTruthy();
});

function createInteractiveMap(clickTolerance, dragPan) {
    vi.spyOn(Map.prototype, '_detectMissingCSS').mockImplementation(() => {});
    return new Map({
        container: DOM.create('div', '', window.document.body),
        clickTolerance: clickTolerance || 0,
        dragPan: dragPan || true,
        testMode: true,
        interactive: true,
        style: {
            version: 8,
            center: [0, 0],
            zoom: 15.7,
            sources: {},
            layers: [{
                "id": "background",
                "type": "background",
                "paint": {
                    "background-color": "black"
                }
            }],
            pitch: 0
        }
    });
}

describe('Drag pan ortho', () => {
    let map, cache;

    const assertAlmostEqual = (actual, expected, epsilon = 1e-3) => {
        expect(Math.abs(actual - expected) < epsilon).toBeTruthy();
    };

    beforeAll(async () => {
        map = createInteractiveMap();

        await waitFor(map, 'style.load');
        map.addSource('mapbox-dem', {
            "type": "raster-dem",
            "tiles": ['http://example.com/{z}/{x}/{y}.png'],
            "tileSize": TILE_SIZE,
            "maxzoom": 14
        });
        cache = map.style.getOwnSourceCache('mapbox-dem');
        cache.used = cache._sourceLoaded = true;
    });

    const mockDem = (dem, cache) => {
        cache._loadTile = (tile, callback) => {
            tile.dem = dem;
            tile.needsHillshadePrepare = true;
            tile.needsDEMTextureUpload = true;
            tile.state = 'loaded';
            callback(null);
        };
    };

    test('ortho camera & drag over zero pitch elevation', async () => {
        mockDem(createNegativeGradientDEM(), cache);
        map.setTerrain({"source": "mapbox-dem"});
        map.setPitch(0);
        map.setZoom(15.7);
        map.setCamera({"camera-projection": "orthographic"});
        await waitFor(map, "render");

        // MouseEvent.buttons = 1 // left button
        const buttons = 1;
        map._updateTerrain();
        expect(map.getZoom()).toEqual(15.7);

        const dragstart = vi.fn();
        const drag      = vi.fn();
        const dragend   = vi.fn();

        map.on('dragstart', dragstart);
        map.on('drag',      drag);
        map.on('dragend',   dragend);

        simulate.mousedown(map.getCanvas());
        map._renderTaskQueue.run();
        simulate.mousemove(window.document.body, {buttons, clientX: 15, clientY: 15});
        map._renderTaskQueue.run();
        expect(dragstart).toHaveBeenCalledTimes(1);
        expect(drag).toHaveBeenCalledTimes(1);
        expect(dragend).not.toHaveBeenCalled();

        simulate.mouseup(map.getCanvas());
        map._renderTaskQueue.run();
        expect(dragstart).toHaveBeenCalledTimes(1);
        expect(drag).toHaveBeenCalledTimes(1);
        expect(dragend).toHaveBeenCalledTimes(1);

        expect(map.getZoom()).toEqual(15.7); // recenter on pitch.

        // Still in ortho
        map.setPitch(5);
        simulate.mousedown(map.getCanvas());
        map._renderTaskQueue.run();
        simulate.mousemove(window.document.body, {buttons, clientX: 15, clientY: 15});
        map._renderTaskQueue.run();

        simulate.mouseup(map.getCanvas());
        map._renderTaskQueue.run();
        expect(dragend).toHaveBeenCalledTimes(2);
        assertAlmostEqual(map.getZoom(), 13.35, 0.01);

        map.setPitch(0);
        simulate.mousedown(map.getCanvas());
        map._renderTaskQueue.run();
        simulate.mousemove(window.document.body, {buttons, clientX: 15, clientY: 15});
        map._renderTaskQueue.run();

        simulate.mouseup(map.getCanvas());
        map._renderTaskQueue.run();
        expect(dragend).toHaveBeenCalledTimes(3);
        assertAlmostEqual(map.getZoom(), 13.35, 0.01); // no pitch, keep old zoom.

        map.remove();
    });
});

describe('Negative Elevation', () => {
    let map, cache;

    beforeAll(async () => {
        map = createMap({
            style: createStyle()
        });
        await waitFor(map, 'style.load');
        map.addSource('mapbox-dem', {
            "type": "raster-dem",
            "tiles": ['http://example.com/{z}/{x}/{y}.png'],
            "tileSize": TILE_SIZE,
            "maxzoom": 14
        });
        cache = map.style.getOwnSourceCache('mapbox-dem');
        cache.used = cache._sourceLoaded = true;
    });

    const mockDem = (dem, cache) => {
        cache._loadTile = (tile, callback) => {
            tile.dem = dem;
            tile.needsHillshadePrepare = true;
            tile.needsDEMTextureUpload = true;
            tile.state = 'loaded';
            callback(null);
        };
    };

    const assertAlmostEqual = (actual, expected, epsilon = 1e-3) => {
        expect(Math.abs(actual - expected) < epsilon).toBeTruthy();
    };

    describe('sampling with negative elevation', () => {
        beforeAll(async () => {
            mockDem(createNegativeGradientDEM(), cache);
            map.setTerrain({"source": "mapbox-dem"});
            await waitFor(map, 'render');
            map._updateTerrain();
        });

        test('negative elevation', () => {
            const minElevation = map.painter.terrain.getMinElevationBelowMSL();
            assertAlmostEqual(minElevation, -1671.55);
            cache.clearTiles();
        });
    });

    describe('sampling with negative elevation and exaggeration', () => {
        beforeAll(async () => {
            mockDem(createNegativeGradientDEM(), cache);
            map.setTerrain({"source": "mapbox-dem", "exaggeration": 1.5});
            await waitFor(map, 'render');
            map._updateTerrain();
        });

        test('negative elevation with exaggeration', () => {
            const minElevation = map.painter.terrain.getMinElevationBelowMSL();
            assertAlmostEqual(minElevation, -2507.325);
            cache.clearTiles();
        });
    });

    describe('sampling with no negative elevation', () => {
        beforeAll(async () => {
            mockDem(createGradientDEM(), cache);
            map.setTerrain({"source": "mapbox-dem"});
            await waitFor(map, 'render');
            map._updateTerrain();
        });

        test('no negative elevation', () => {
            const minElevation = map.painter.terrain.getMinElevationBelowMSL();
            expect(minElevation).toEqual(0);
            cache.clearTiles();
        });
    });
});

describe('Vertex morphing', () => {
    const createTile = (id) => {
        const tile = new Tile(id);
        tile.demTexture = {};
        tile.state = 'loaded';
        return tile;
    };

    test('Morph single tile', () => {
        const morphing = new VertexMorphing();
        const coord = new OverscaledTileID(2, 0, 2, 1, 1);
        const src = createTile(new OverscaledTileID(4, 0, 4, 8, 15));
        const dst = createTile(new OverscaledTileID(5, 0, 5, 8, 15));

        morphing.newMorphing(coord.key, src, dst, 0, 250);
        let values = morphing.getMorphValuesForProxy(coord.key);
        expect(values).toBeTruthy();

        // Initial state
        expect(values.from).toEqual(src);
        expect(values.to).toEqual(dst);
        expect(values.phase).toEqual(0);

        morphing.update(125);

        // Half way through
        values = morphing.getMorphValuesForProxy(coord.key);
        expect(values).toBeTruthy();
        expect(values.from).toEqual(src);
        expect(values.to).toEqual(dst);
        expect(values.phase).toEqual(0.5);

        // Done
        values = morphing.getMorphValuesForProxy(250);
        expect(values).toBeFalsy();
    });

    test('Queue dem tiles', () => {
        const morphing = new VertexMorphing();
        const coord = new OverscaledTileID(2, 0, 2, 1, 1);
        const src = createTile(new OverscaledTileID(4, 0, 4, 8, 15));
        const dst = createTile(new OverscaledTileID(5, 0, 5, 8, 15));
        const intermediate = createTile(new OverscaledTileID(5, 0, 5, 9, 16));
        const queued = createTile(new OverscaledTileID(6, 0, 5, 9, 16));

        // Intermediate steps are expected to be discarded and only destination tile matters for queued morphing
        morphing.newMorphing(coord.key, src, dst, 0, 500);
        morphing.newMorphing(coord.key, dst, intermediate, 0, 500);
        morphing.newMorphing(coord.key, src, queued, 0, 500);
        let values = morphing.getMorphValuesForProxy(coord.key);
        expect(values).toBeTruthy();

        morphing.update(250);
        values = morphing.getMorphValuesForProxy(coord.key);
        expect(values).toBeTruthy();
        expect(values.from).toEqual(src);
        expect(values.to).toEqual(dst);
        expect(values.phase).toEqual(0.5);

        // Expect to find the `queued` tile. `intermediate` should have been discarded
        morphing.update(500);
        values = morphing.getMorphValuesForProxy(coord.key);
        expect(values).toBeTruthy();
        expect(values.from).toEqual(dst);
        expect(values.to).toEqual(queued);
        expect(values.phase).toEqual(0.0);

        morphing.update(750);
        values = morphing.getMorphValuesForProxy(coord.key);
        expect(values).toBeTruthy();
        expect(values.from).toEqual(dst);
        expect(values.to).toEqual(queued);
        expect(values.phase).toEqual(0.5);

        morphing.update(1000);
        values = morphing.getMorphValuesForProxy(coord.key);
        expect(values).toBeFalsy();
    });

    test('Queue dem tiles multiple times', () => {
        const morphing = new VertexMorphing();
        const coord = new OverscaledTileID(2, 0, 2, 1, 1);
        const src = createTile(new OverscaledTileID(4, 0, 4, 8, 15));
        const dst = createTile(new OverscaledTileID(5, 0, 5, 8, 15));
        const duplicate0 = createTile(new OverscaledTileID(5, 0, 5, 8, 15));
        const duplicate1 = createTile(new OverscaledTileID(5, 0, 5, 8, 15));
        const duplicate2 = createTile(new OverscaledTileID(5, 0, 5, 8, 15));

        morphing.newMorphing(coord.key, src, dst, 0, 100);
        morphing.newMorphing(coord.key, src, duplicate0, 0, 100);
        morphing.newMorphing(coord.key, src, duplicate1, 0, 100);
        morphing.newMorphing(coord.key, src, duplicate2, 0, 100);
        let values = morphing.getMorphValuesForProxy(coord.key);
        expect(values).toBeTruthy();

        morphing.update(75);
        values = morphing.getMorphValuesForProxy(coord.key);
        expect(values).toBeTruthy();
        expect(values.from).toEqual(src);
        expect(values.to).toEqual(dst);
        expect(values.phase).toEqual(0.75);

        morphing.update(110);
        values = morphing.getMorphValuesForProxy(coord.key);
        expect(values).toBeFalsy();
    });

    test('Expired data', () => {
        const morphing = new VertexMorphing();
        const coord = new OverscaledTileID(2, 0, 2, 1, 1);
        const src = createTile(new OverscaledTileID(4, 0, 4, 8, 15));
        const dst = createTile(new OverscaledTileID(5, 0, 5, 8, 15));
        const queued = createTile(new OverscaledTileID(6, 0, 5, 9, 16));

        morphing.newMorphing(coord.key, src, dst, 0, 1000);
        morphing.newMorphing(coord.key, dst, queued, 0, 1000);

        morphing.update(200);
        let values = morphing.getMorphValuesForProxy(coord.key);
        expect(values).toBeTruthy();
        expect(values.from).toEqual(src);
        expect(values.to).toEqual(dst);
        expect(values.phase).toEqual(0.2);

        // source tile is expired
        src.state = 'unloaded';
        morphing.update(300);
        values = morphing.getMorphValuesForProxy(coord.key);
        expect(values).toBeTruthy();
        expect(values.from).toEqual(dst);
        expect(values.to).toEqual(queued);
        expect(values.phase).toEqual(0.0);

        const newQueued = createTile(new OverscaledTileID(7, 0, 7, 9, 16));
        morphing.newMorphing(coord.key, queued, newQueued, 1000);

        // The target tile is expired. The morphing operation should be cancelled
        queued.state = 'unloaded';
        morphing.update(500);
        values = morphing.getMorphValuesForProxy(coord.key);
        expect(values).toBeFalsy();
    });
});

describe('Render cache efficiency', () => {
    describe('Optimized for terrain, various efficiency', () => {
        let map;
        beforeAll(async () => {
            map = createMap({
                style: {
                    version: 8,
                    center: [85, 85],
                    zoom: 2.1,
                    sources: {
                        'mapbox-dem': {
                            type: 'raster-dem',
                            tiles: ['http://example.com/{z}/{x}/{y}.png'],
                            tileSize: 512,
                            maxzoom: 14
                        },
                        geojson: {
                            type: 'geojson',
                            data: {
                                type: 'Point',
                                coordinates: [
                                    0,
                                    0
                                ]
                            }
                        }
                    },
                    layers: []
                }
            });
            await waitFor(map, 'style.load');
            const cache = map.style.getOwnSourceCache('mapbox-dem');
            cache._loadTile = (tile, callback) => {
                const pixels = new Uint8Array((512 + 2) * (512 + 2) * 4);
                tile.dem = new DEMData(0, new RGBAImage({height: 512 + 2, width: 512 + 2}, pixels));
                tile.needsHillshadePrepare = true;
                tile.needsDEMTextureUpload = true;
                tile.state = 'loaded';
                callback(null);
            };
            map.setTerrain({'source': 'mapbox-dem'});
            await waitFor(map, 'render');
            map._updateTerrain();
            map.addLayer({
                'id': 'background',
                'type': 'background'
            });
        });

        beforeEach(() => {
            // Stub console.warn to prevent test fail
            vi.spyOn(console, 'warn').mockImplementation(() => {});
        });

        test('Cache efficiency 1', () => {
            map.addLayer({
                'id': 'undraped1',
                'type': 'symbol',
                'source': 'geojson'
            });
            expect(map.painter.terrain.isLayerOrderingCorrect(map.painter.style)).toBeTruthy();
            map.removeLayer('undraped1');
        });

        test('Cache efficiency 2', () => {
            map.addLayer({
                'id': 'draped1',
                'type': 'fill',
                'source': 'geojson'
            });
            map.addLayer({
                'id': 'draped2',
                'type': 'fill',
                'source': 'geojson'
            });
            map.addLayer({
                'id': 'undraped1',
                'type': 'symbol',
                'source': 'geojson'
            });
            expect(map.painter.terrain.isLayerOrderingCorrect(map.painter.style)).toBeTruthy();
            map.removeLayer('draped1');
            map.removeLayer('draped2');
            map.removeLayer('undraped1');
        });

        test('Cache efficiency 3', () => {
            map.addLayer({
                'id': 'draped1',
                'type': 'fill',
                'source': 'geojson'
            });
            map.addLayer({
                'id': 'draped2',
                'type': 'fill',
                'source': 'geojson'
            });
            map.addLayer({
                'id': 'undraped1',
                'type': 'symbol',
                'source': 'geojson'
            });
            map.addLayer({
                'id': 'draped3',
                'type': 'fill',
                'source': 'geojson'
            });
            expect(map.painter.terrain.isLayerOrderingCorrect(map.painter.style)).toBeTruthy();
            map.removeLayer('draped1');
            map.removeLayer('draped2');
            map.removeLayer('draped3');
            map.removeLayer('undraped1');
        });

        test('Cache efficiency 4', () => {
            map.addLayer({
                'id': 'draped1',
                'type': 'fill',
                'source': 'geojson'
            });
            map.addLayer({
                'id': 'undraped1',
                'type': 'symbol',
                'source': 'geojson'
            });
            map.addLayer({
                'id': 'draped2',
                'type': 'fill',
                'source': 'geojson'
            });
            map.addLayer({
                'id': 'draped3',
                'type': 'fill',
                'source': 'geojson'
            });
            expect(map.painter.terrain.isLayerOrderingCorrect(map.painter.style)).toBeTruthy();
            map.removeLayer('draped1');
            map.removeLayer('draped2');
            map.removeLayer('draped3');
            map.removeLayer('undraped1');
        });
    });

    describe('Optimized for terrain, 100% efficiency', () => {
        let map;
        beforeAll(async () => {

            map = createMap({
                style: {
                    version: 8,
                    center: [85, 85],
                    zoom: 2.1,
                    sources: {
                        'mapbox-dem': {
                            type: 'raster-dem',
                            tiles: ['http://example.com/{z}/{x}/{y}.png'],
                            tileSize: 512,
                            maxzoom: 14
                        },
                        geojson: {
                            type: 'geojson',
                            data: {
                                type: 'Point',
                                coordinates: [
                                    0,
                                    0
                                ]
                            }
                        }
                    },
                    layers: []
                }
            });
            await waitFor(map, 'style.load');
            const cache = map.style.getOwnSourceCache('mapbox-dem');
            cache._loadTile = (tile, callback) => {
                const pixels = new Uint8Array((512 + 2) * (512 + 2) * 4);
                tile.dem = new DEMData(0, new RGBAImage({height: 512 + 2, width: 512 + 2}, pixels));
                tile.needsHillshadePrepare = true;
                tile.needsDEMTextureUpload = true;
                tile.state = 'loaded';
                callback(null);
            };
            map.setTerrain({'source': 'mapbox-dem'});
            await waitFor(map, 'render');
            map._updateTerrain();
            map.addLayer({
                'id': 'background',
                'type': 'background'
            });
        });

        beforeEach(() => {
            // Stub console.warn to prevent test fail
            vi.spyOn(console, 'warn').mockImplementation(() => {});
        });

        test('Cache efficiency 1', () => {
            map.addLayer({
                'id': 'undraped1',
                'type': 'symbol',
                'source': 'geojson'
            });
            expect(map.painter.terrain.isLayerOrderingCorrect(map.painter.style)).toBeTruthy();
            map.removeLayer('undraped1');
        });

        test('Cache efficiency 2', () => {
            map.addLayer({
                'id': 'draped1',
                'type': 'fill',
                'source': 'geojson'
            });
            map.addLayer({
                'id': 'draped2',
                'type': 'fill',
                'source': 'geojson'
            });
            map.addLayer({
                'id': 'undraped1',
                'type': 'symbol',
                'source': 'geojson'
            });
            expect(map.painter.terrain.isLayerOrderingCorrect(map.painter.style)).toBeTruthy();
            map.removeLayer('draped1');
            map.removeLayer('draped2');
            map.removeLayer('undraped1');
        });

        test('Cache efficiency 3', () => {
            map.addLayer({
                'id': 'draped1',
                'type': 'fill',
                'source': 'geojson'
            });
            map.addLayer({
                'id': 'draped2',
                'type': 'fill',
                'source': 'geojson'
            });
            map.addLayer({
                'id': 'undraped1',
                'type': 'symbol',
                'source': 'geojson'
            });
            map.addLayer({
                'id': 'draped3',
                'type': 'fill',
                'source': 'geojson'
            });
            expect(map.painter.terrain.isLayerOrderingCorrect(map.painter.style)).toBeTruthy();
            map.removeLayer('draped1');
            map.removeLayer('draped2');
            map.removeLayer('draped3');
            map.removeLayer('undraped1');
        });

        test('Cache efficiency 4', () => {
            map.addLayer({
                'id': 'draped1',
                'type': 'fill',
                'source': 'geojson'
            });
            map.addLayer({
                'id': 'undraped1',
                'type': 'symbol',
                'source': 'geojson'
            });
            map.addLayer({
                'id': 'draped2',
                'type': 'fill',
                'source': 'geojson'
            });
            map.addLayer({
                'id': 'draped3',
                'type': 'fill',
                'source': 'geojson'
            });
            expect(map.painter.terrain.isLayerOrderingCorrect(map.painter.style)).toBeTruthy();
            map.removeLayer('draped1');
            map.removeLayer('draped2');
            map.removeLayer('draped3');
            map.removeLayer('undraped1');
        });
    });
});

describe('Marker interaction and raycast', () => {
    let map, marker, tr;

    beforeAll(async () => {
        map = createMap({
            style: extend(createStyle(), {
                layers: [{
                    "id": "background",
                    "type": "background",
                    "paint": {
                        "background-color": "black"
                    }
                }]
            })
        });
        map.setPitch(85);
        map.setZoom(13);

        tr = map.transform;
        marker = new Marker({draggable: true})
            .setLngLat(tr.center)
            .addTo(map)
            .setPopup(new Popup().setHTML(`a popup content`))
            .togglePopup();

        await waitFor(map, 'style.load');
    });

    test('marker positioned in center', () => {
        expect(map.project(marker.getLngLat()).y).toEqual(tr.height / 2);
        expect(tr.locationPoint3D(marker.getLngLat()).y).toEqual(tr.height / 2);
        expect(marker.getPopup()._pos).toEqual(new Point(tr.width / 2, tr.height / 2));
    });

    describe('interaction', () => {
        let terrainTop, terrainTopLngLat;

        beforeAll(async () => {
            map.addSource('mapbox-dem', {
                "type": "raster-dem",
                "tiles": ['http://example.com/{z}/{x}/{y}.png'],
                "tileSize": TILE_SIZE,
                "maxzoom": 14
            });
            map.transform._horizonShift = 0;
            const cache = map.style.getOwnSourceCache('mapbox-dem');
            cache.used = cache._sourceLoaded = true;
            cache._loadTile = (tile, callback) => {
            // Elevate tiles above center.
                tile.dem = createConstElevationDEM(300 * (tr.zoom - tile.tileID.overscaledZ), TILE_SIZE);
                tile.needsHillshadePrepare = true;
                tile.needsDEMTextureUpload = true;
                tile.state = 'loaded';
                callback(null);
            };
            map.setTerrain({"source": "mapbox-dem"});
            await waitFor(map, 'render');
            map._updateTerrain();
            terrainTopLngLat = tr.pointLocation3D(new Point(tr.width / 2, 0)); // gets clamped at the top of terrain
            terrainTop = tr.locationPoint3D(terrainTopLngLat);
        });

        test('no changes at center', () => {
            expect(map.project(marker.getLngLat()).y).toEqual(tr.height / 2);
            expect(tr.locationPoint3D(marker.getLngLat()).y).toEqual(tr.height / 2);
            expect(marker.getPopup()._pos).toEqual(new Point(tr.width / 2, tr.height / 2));
        });

        test('terrain is above horizon line', () => {
        // With a bit of tweaking (given that const terrain planes are used), terrain is above horizon line.
            expect(terrainTop.y < tr.horizonLineFromTop() - 3).toBeTruthy();
        });

        test('Drag above clamps at horizon', () => {
        // Offset marker down, 2 pixels under terrain top above horizon.
            const startPos = new Point(0, 2)._add(terrainTop);
            marker.setLngLat(tr.pointLocation3D(startPos));
            expect(Math.abs(tr.locationPoint3D(marker.getLngLat()).y - startPos.y) < 0.000001).toBeTruthy();
            const el = marker.getElement();

            simulate.mousedown(el);
            simulate.mousemove(el, {clientX: 0, clientY: -40});
            simulate.mouseup(el);

            const endPos = tr.locationPoint3D(marker.getLngLat());
            expect(Math.abs(endPos.x - startPos.x) < 0.00000000001).toBeTruthy();
            expect(endPos.y).toEqual(terrainTop.y);
            expect(marker.getPopup()._pos).toEqual(endPos);
        });

        test('Drag below / behind camera', () => {
            const startPos = new Point(terrainTop.x, tr.height - 20);
            marker.setLngLat(tr.pointLocation3D(startPos));
            expect(Math.abs(tr.locationPoint3D(marker.getLngLat()).y - startPos.y) < 0.000001).toBeTruthy();
            const el = marker.getElement();

            simulate.mousedown(el);
            simulate.mousemove(el, {clientX: 0, clientY: 40});
            simulate.mouseup(el);

            const endPos = tr.locationPoint3D(marker.getLngLat());
            expect(Math.round(endPos.y)).toEqual(Math.round(startPos.y) + 40);
            expect(marker.getPopup()._pos).toEqual(endPos);
        });

        test('Occluded', async () => {
            marker._fadeTimer = null;
            // Occlusion is happening with Timers API. Advance them
            vi.spyOn(window, 'setTimeout').mockImplementation((cb) => cb());
            marker.setLngLat(terrainTopLngLat);
            const bottomLngLat = tr.pointLocation3D(new Point(terrainTop.x, tr.height));
            // Raycast returns distance to closer point evaluates to occluded marker.
            vi.spyOn(tr, 'pointLocation3D').mockImplementation(() => bottomLngLat);
            await waitFor(map, "render");
            expect(marker.getElement().style.opacity).toEqual("0.2");
        });

        test(`Marker updates position on removing terrain (#10982)`, async () => {
            const update = vi.spyOn(marker, "_update");
            map.setTerrain(null);
            await waitFor(map, 'render');
            expect(update).toHaveBeenCalledTimes(1);
        });

        test(`Marker updates position on adding terrain (#10982)`, async () => {
            const update = vi.spyOn(marker, "_update");
            map.setTerrain({"source": "mapbox-dem"});
            await waitFor(map, 'render');
            expect(update).toHaveBeenCalledTimes(1);
        });
    });
});

describe('terrain getBounds', () => {
    test('should has correct coordinates of center', async () => {
        const map = createMap({
            style: extend(createStyle(), {
                layers: [{
                    "id": "background",
                    "type": "background",
                    "paint": {
                        "background-color": "black"
                    }
                }]
            })
        });
        map.setPitch(85);
        map.setZoom(13);
        map.transform._horizonShift = 0;

        const tr = map.transform;
        await waitFor(map, 'style.load');

        map.addSource('mapbox-dem', {
            "type": "raster-dem",
            "tiles": ['http://example.com/{z}/{x}/{y}.png'],
            "tileSize": TILE_SIZE,
            "maxzoom": 14
        });
        const cache = map.style.getOwnSourceCache('mapbox-dem');
        cache.used = cache._sourceLoaded = true;
        cache._loadTile = (tile, callback) => {
            // Elevate tiles above center.
            tile.dem = createConstElevationDEM(300 * (tr.zoom - tile.tileID.overscaledZ), TILE_SIZE);
            tile.needsHillshadePrepare = true;
            tile.needsDEMTextureUpload = true;
            tile.state = 'loaded';
            callback(null);
        };
        expect(map.getBounds().getCenter().lng.toFixed(7)).toEqual('-0.0000000');
        expect(map.getBounds().getCenter().lat.toFixed(10)).toEqual('-42.5358013246');

        map.setTerrain({"source": "mapbox-dem"});
        await waitFor(map, 'render');

        map._updateTerrain();

        // As tiles above center are elevated, center of bounds is closer to camera.
        expect(map.getBounds().getCenter().lng.toFixed(4)).toEqual('0.0000');
        expect(map.getBounds().getCenter().lat.toFixed(10)).toEqual('-42.5482497247');

        map.setPitch(0);

        await waitFor(map, 'render');

        expect(map.getBounds().getCenter().lng.toFixed(10)).toEqual('-0.0000000000');
        expect(map.getBounds().getCenter().lat.toFixed(10)).toEqual('0.0000000000');
    });

    test('recognizes padding', async () => {
        const style = createStyle();
        const map = createMap({style, zoom: 1, bearing: 45});

        map.setPadding({
            left: 100,
            right: 10,
            top: 10,
            bottom: 10
        });
        map.setCenter([0, 0]);

        await waitFor(map, 'style.load');

        setMockElevationTerrain(map, zeroDem, TILE_SIZE);

        await waitFor(map, 'render');
        expect(map.transform.elevation).toBeTruthy();
        const padded = toFixed(map.getBounds().toArray());
        map.setPadding({
            left: 0,
            right: 0,
            top: 0,
            bottom: 0
        });
        const unpadded = toFixed(map.getBounds().toArray());
        expect(padded).not.toBe(unpadded);
        expect(toFixed([[-33.5599507477, -31.7907658998], [33.5599507477, 31.7907658998]])).toStrictEqual(padded);
        expect(toFixed([[-49.7184455522, -44.4454158060], [49.7184455522, 44.4454158060]])).toStrictEqual(unpadded);
    });

    test('Does not overflow at poles', async () => {
        const map = createMap({zoom: 2, center: [0, 90], pitch: 80});
        await waitFor(map, 'style.load');
        setMockElevationTerrain(map, zeroDem, TILE_SIZE);
        await waitFor(map, 'render');
        expect(map.transform.elevation).toBeTruthy();
        const bounds = map.getBounds();
        expect(bounds.getNorth().toFixed(6)).toBe(MAX_MERCATOR_LATITUDE.toFixed(6));
        expect(toFixed(bounds.toArray())).toStrictEqual(toFixed([[ -23.3484820899, 77.6464759596 ], [ 23.3484820899, 85.0511287798 ]]));

        map.setBearing(180);
        map.setCenter({lng: 0, lat: -90});

        const sBounds = map.getBounds();
        expect(sBounds.getSouth().toFixed(6)).toBe((-MAX_MERCATOR_LATITUDE).toFixed(6));
        expect(toFixed(sBounds.toArray())).toStrictEqual(toFixed([[ -23.3484820899, -85.0511287798 ], [ 23.3484820899, -77.6464759596]]));
    });

    test("Does not break with no visible DEM tiles (#10610)", async () => {
        const style = createStyle();
        const map = createMap({style, zoom: 1, bearing: 45});
        map.setCenter([0, 0]);
        await waitFor(map, 'load');
        setMockElevationTerrain(map, zeroDem, TILE_SIZE);
        map.setTerrain({source: "mapbox-dem"});
        await waitFor(map, 'render');
        expect(map.transform.elevation).toBeTruthy();
        const bounds = toFixed(map.getBounds().toArray());

        // Mocking the behavior when the map zooms quickly
        map.transform.elevation._visibleDemTiles = [];

        expect(toFixed([
            [-49.7184455522, -44.445415806],
            [49.7184455522, 44.445415806],
        ])).toStrictEqual(bounds);
    });

    function toFixed(bounds) {
        const n = 9;
        return [
            [bounds[0][0].toFixed(n), bounds[0][1].toFixed(n)],
            [bounds[1][0].toFixed(n), bounds[1][1].toFixed(n)]
        ];
    }

});

test('terrain recursively loads parent tiles on 404', async () => {
    const style = createStyle();
    const map = createMap({style, center: [0, 0], zoom: 16});

    await waitFor(map, 'style.load');

    map.addSource('mapbox-dem', {
        'type': 'raster-dem',
        'tiles': ['http://example.com/{z}/{x}/{y}.png'],
        'tileSize': TILE_SIZE,
        'maxzoom': 14
    });

    const cache = map.style.getOwnSourceCache('mapbox-dem');
    cache.used = cache._sourceLoaded = true;
    cache._loadTile = (tile, callback) => {
        if (tile.tileID.canonical.z > 10) {
            setTimeout(() => callback({status: 404}), 0);
        } else {
            tile.state = 'loaded';
            callback(null);
        }
    };

    map.setTerrain({'source': 'mapbox-dem'});

    await waitFor(map, 'idle');

    expect(cache.getRenderableIds()).toEqual([
        new OverscaledTileID(10, 0, 10, 512, 512).key,
        new OverscaledTileID(10, 0, 10, 511, 512).key,
        new OverscaledTileID(10, 0, 10, 512, 511).key,
        new OverscaledTileID(10, 0, 10, 511, 511).key,
    ]);

    expect(cache.getIds()).toEqual([
        new OverscaledTileID(10, 0, 10, 512, 512).key,
        new OverscaledTileID(10, 0, 10, 511, 512).key,
        new OverscaledTileID(10, 0, 10, 512, 511).key,
        new OverscaledTileID(10, 0, 10, 511, 511).key,
        new OverscaledTileID(11, 0, 11, 1024, 1024).key,
        new OverscaledTileID(11, 0, 11, 1023, 1024).key,
        new OverscaledTileID(11, 0, 11, 1024, 1023).key,
        new OverscaledTileID(11, 0, 11, 1023, 1023).key,
        new OverscaledTileID(12, 0, 12, 2048, 2048).key,
        new OverscaledTileID(12, 0, 12, 2047, 2048).key,
        new OverscaledTileID(12, 0, 12, 2048, 2047).key,
        new OverscaledTileID(12, 0, 12, 2047, 2047).key,
        new OverscaledTileID(13, 0, 13, 4096, 4096).key,
        new OverscaledTileID(13, 0, 13, 4095, 4096).key,
        new OverscaledTileID(13, 0, 13, 4096, 4095).key,
        new OverscaledTileID(13, 0, 13, 4095, 4095).key,
        new OverscaledTileID(14, 0, 14, 8192, 8192).key,
        new OverscaledTileID(14, 0, 14, 8191, 8192).key,
        new OverscaledTileID(14, 0, 14, 8192, 8191).key,
        new OverscaledTileID(14, 0, 14, 8191, 8191).key,
    ]);
});
