import {test} from '../../util/test.js';
import {extend} from '../../../src/util/util.js';
import {createMap} from '../../util/index.js';
import DEMData from '../../../src/data/dem_data.js';
import {RGBAImage} from '../../../src/util/image.js';
import MercatorCoordinate from '../../../src/geo/mercator_coordinate.js';
import window from '../../../src/util/window.js';
import {OverscaledTileID} from '../../../src/source/tile_id.js';
import styleSpec from '../../../src/style-spec/reference/latest.js';
import Terrain from '../../../src/style/terrain.js';
import Tile from '../../../src/source/tile.js';
import {VertexMorphing} from '../../../src/terrain/draw_terrain_raster.js';
import {fixedLngLat, fixedCoord, fixedPoint} from '../../util/fixed.js';
import Point from '@mapbox/point-geometry';
import LngLat from '../../../src/geo/lng_lat.js';
import Marker, {TERRAIN_OCCLUDED_OPACITY} from '../../../src/ui/marker.js';
import Popup from '../../../src/ui/popup.js';
import simulate from '../../util/simulate_interaction.js';
import {createConstElevationDEM, setMockElevationTerrain} from '../../util/dem_mock.js';

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
    return new DEMData(0, new RGBAImage({height: TILE_SIZE + 2, width: TILE_SIZE + 2}, pixels), "mapbox", false, true);
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
    return new DEMData(0, new RGBAImage({height: TILE_SIZE + 2, width: TILE_SIZE + 2}, pixels), "mapbox", false, true);
};

test('Elevation', (t) => {
    const dem = createGradientDEM();

    t.beforeEach((callback) => {
        window.useFakeXMLHttpRequest();
        callback();
    });

    t.afterEach((callback) => {
        window.restore();
        callback();
    });

    t.test('elevation sampling', t => {
        const map = createMap(t);
        map.on('style.load', () => {
            setMockElevationTerrain(map, zeroDem, TILE_SIZE);
            map.once('render', () => {
                const elevationError = -1;
                t.test('Sample', t => {
                    const elevation = map.painter.terrain.getAtPoint({x: 0.51, y: 0.49}, elevationError);
                    t.equal(elevation, 0);
                    t.end();
                });

                t.test('Invalid sample position', t => {
                    const elevation1 = map.painter.terrain.getAtPoint({x: 0.5, y: 1.1}, elevationError);
                    const elevation2 = map.painter.terrain.getAtPoint({x: 1.15, y: -0.001}, elevationError);
                    t.equal(elevation1, elevationError);
                    t.equal(elevation2, elevationError);
                    t.end();
                });
                t.end();
            });
        });
    });

    t.test('style diff / remove dem source cache', t => {
        const map = createMap(t);
        map.on('style.load', () => {
            setMockElevationTerrain(map, zeroDem, TILE_SIZE);
            map.once('render', () => {
                t.test('Throws error if style update tries to remove terrain DEM source', t => {
                    t.test('remove source', t => {
                        const stub = t.stub(console, 'error');
                        map.removeSource('mapbox-dem');
                        t.ok(stub.calledOnce);
                        t.end();
                    });
                    t.end();
                });
                t.end();
            });
        });
    });

    t.test('style diff=false removes dem source', t => {
        const map = createMap(t);
        map.once('style.load', () => {
            setMockElevationTerrain(map, zeroDem, TILE_SIZE);
            map.once('render', () => {
                map._updateTerrain();
                const elevationError = -1;
                const terrain = map.painter.terrain;
                const elevation1 = map.painter.terrain.getAtPoint({x: 0.5, y: 0.5}, elevationError);
                t.equal(elevation1, 0);

                map.setStyle(createStyle(), {diff: false});

                const elevation2 = terrain.getAtPoint({x: 0.5, y: 0.5}, elevationError);
                t.equal(elevation2, elevationError);
                t.end();
            });
        });
    });

    t.test('interpolation', t => {
        const map = createMap(t, {
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
        map.on('style.load', () => {
            map.addSource('mapbox-dem', {
                "type": "raster-dem",
                "tiles": ['http://example.com/{z}/{x}/{y}.png'],
                "tileSize": TILE_SIZE,
                "maxzoom": 14
            });
            const cache = map.style._getSourceCache('mapbox-dem');
            cache.used = cache._sourceLoaded = true;
            cache._loadTile = (tile, callback) => {
                tile.dem = dem;
                tile.needsHillshadePrepare = true;
                tile.needsDEMTextureUpload = true;
                tile.state = 'loaded';
                callback(null);
            };
            map.setTerrain({"source": "mapbox-dem"});
            map.once('render', () => {
                const cache = map.style._getSourceCache('mapbox-dem');

                t.test('terrain tiles loaded wrap', t => {
                    const tile = cache.getTile(new OverscaledTileID(14, 1, 14, 0, 8192));
                    t.assert(tile.dem);
                    t.end();
                });

                t.test('terrain tiles loaded no wrap', t => {
                    const tile = cache.getTile(new OverscaledTileID(14, 0, 14, 16383, 8192));
                    t.assert(tile.dem);
                    t.end();
                });

                const tilesAtTileZoom = 1 << 14;
                // Calculate offset to neighbor value in dem bitmap.
                const dx = 1 / (tilesAtTileZoom * TILE_SIZE);

                const coord = MercatorCoordinate.fromLngLat({lng: 180, lat: 0});
                t.equal(map.painter.terrain.getAtPoint(coord), 0);

                t.test('dx', t => {
                    const elevationDx = map.painter.terrain.getAtPoint({x: coord.x + dx, y: coord.y});
                    t.assert(Math.abs(elevationDx - 0.1) < 1e-12);
                    t.end();
                });

                t.test('dy', t => {
                    const elevationDy = map.painter.terrain.getAtPoint({x: coord.x, y: coord.y + dx});
                    const expectation = TILE_SIZE * 0.1;
                    t.assert(Math.abs(elevationDy - expectation) < 1e-12);
                    t.end();
                });

                t.test('dx/3 dy/3', t => {
                    const elevation = map.painter.terrain.getAtPoint({x: coord.x + dx / 3, y: coord.y + dx / 3});
                    const expectation = (2 * TILE_SIZE + 2) * 0.1 / 6;
                    t.assert(Math.abs(elevation - expectation) < 1e-9);
                    t.end();
                });

                t.test('-dx -wrap', t => {
                    const elevation = map.painter.terrain.getAtPoint({x: coord.x - dx, y: coord.y});
                    const expectation = (TILE_SIZE - 1) * 0.1;
                    t.assert(Math.abs(elevation - expectation) < 1e-12);
                    t.end();
                });

                t.test('-1.5dx -wrap', t => {
                    const elevation = map.painter.terrain.getAtPoint({x: coord.x - 1.5 * dx, y: coord.y});
                    const expectation = (TILE_SIZE - 1.5) * 0.1;
                    t.assert(Math.abs(elevation - expectation) < 1e-12);
                    t.end();
                });

                t.test('disable terrain', t => {
                    t.ok(map.painter.terrain);
                    map.setTerrain(null);
                    map.once('render', () => {
                        t.notOk(map.painter.terrain);
                        t.end();
                    });
                });

                t.end();
            });
        });
    });

    t.test('mapbox-gl-js-internal#91', t => {
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
        const map = createMap(t, {
            style: extend(createStyle(), {
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
            t.equal(source.loaded(), false);
            const onLoaded = (e) => {
                if (e.sourceDataType === 'visibility') return;
                source.off('data', onLoaded);
                t.equal(map.getSource('trace').loaded(), true);
                let beganRenderingContent = false;
                map.on('render', () => {
                    const gl = map.painter.context.gl;
                    const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
                    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
                    const centerOffset = map.getContainer().clientWidth / 2 * (map.getContainer().clientHeight + 1) * 4;
                    const isCenterRendered = pixels[centerOffset] === 255;
                    if (!beganRenderingContent) {
                        beganRenderingContent = isCenterRendered;
                        if (beganRenderingContent) {
                            data.features[0].geometry.coordinates.push([180.1, 0.1]);
                            source.setData(data);
                            t.equal(map.getSource('trace').loaded(), false);
                        }
                    } else {
                        // Previous trace data should be rendered while loading update.
                        t.ok(isCenterRendered);
                        setTimeout(() => map.remove(), 0); // avoids re-triggering render after t.end. Don't remove while in render().
                        t.end();
                    }
                });
            };
            source.on('data', onLoaded);
        });
    });

    t.test('mapbox-gl-js-internal#281', t => {
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
        const map = createMap(t, {
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
            const cache = map.style._getSourceCache('mapbox-dem');
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
                        t.test('Source other:trace is cleared from cache', t => {
                            t.ok(map.painter.terrain._tilesDirty.hasOwnProperty('other:trace'));
                            t.true(map.painter.terrain._tilesDirty['other:trace']['0']);
                            t.end();
                        });
                        t.end();
                    }
                });
                const cache = map.style._getSourceCache('trace');
                cache.transform = map.painter.transform;
                cache._addTile(new OverscaledTileID(0, 0, 0, 0, 0));
                cache.onAdd();
                cache.reload();
                cache.used = cache._sourceLoaded = true;
            });
        });
    });

    t.test('mapbox-gl-js-internal#349', t => {
        const map = createMap(t, {
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
        map.on('style.load', () => {
            const customLayer = {
                id: 'custom',
                type: 'custom',
                onAdd: () => {},
                render: () => {}
            };
            map.addLayer(customLayer);
            map.setTerrain({"source": "mapbox-dem"});
            map.once('render', () => {
                map.painter.terrain.renderCached = true;
                t.false(map.painter.terrain._shouldDisableRenderCache());
                t.end();
            });
        });
    });

    t.test('mapbox-gl-js-internal#32', t => {
        const map = createMap(t, {
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

        map.on('style.load', () => {
            const cache = map.style._getSourceCache('mapbox-dem');
            cache._loadTile = (tile, callback) => {
                const pixels = new Uint8Array((512 + 2) * (512 + 2) * 4);
                tile.dem = new DEMData(0, new RGBAImage({height: 512 + 2, width: 512 + 2}, pixels));
                tile.needsHillshadePrepare = true;
                tile.needsDEMTextureUpload = true;
                tile.state = 'loaded';
                callback(null);
            };
            cache.used = cache._sourceLoaded = true;
            const tr = map.painter.transform.clone();
            map.setTerrain({"source": "mapbox-dem"});
            map.once('render', () => {
                map._updateTerrain();
                t.test('center is not further constrained', t => {
                    t.deepEqual(tr.center, map.painter.transform.center);
                    t.end();
                });
                t.end();
            });
        });
    });

    t.end();
});

const spec = styleSpec.terrain;

test('Terrain style', (t) => {
    test('Terrain defaults', (t) => {
        const terrain = new Terrain({});
        terrain.recalculate({zoom: 0, zoomHistory: {}});

        t.deepEqual(terrain.properties.get('source'), spec.source.default);
        t.deepEqual(terrain.properties.get('exaggeration'), spec.exaggeration.default);

        t.end();
    });

    test('Exaggeration with stops function', (t) => {
        const terrain = new Terrain({
            source: "dem",
            exaggeration: {
                stops: [[15, 0.2], [17, 0.8]]
            }
        });
        terrain.recalculate({zoom: 16, zoomHistory: {}});

        t.deepEqual(terrain.properties.get('exaggeration'), 0.5);
        t.end();
    });

    t.end();
});

function nearlyEquals(a, b, eps = 0.000000001) {
    return Object.keys(a).length >= 2 && Object.keys(a).every(key => Math.abs(a[key] - b[key]) < eps);
}

test('Raycast projection 2D/3D', t => {
    const map = createMap(t, {
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

    map.transform._horizonShift = 0;

    map.once('style.load', () => {
        setMockElevationTerrain(map, zeroDem, TILE_SIZE);
        map.once('render', () => {
            map._updateTerrain();

            const transform = map.transform;
            const cx = transform.width / 2;
            const cy = transform.height / 2;
            t.deepEqual(fixedLngLat(transform.pointLocation(new Point(cx, cy))), {lng: 0, lat: 0});
            t.deepEqual(fixedCoord(transform.pointCoordinate(new Point(cx, cy))), {x: 0.5, y: 0.5, z: 0});
            t.ok(nearlyEquals(fixedPoint(transform.locationPoint(new LngLat(0, 0))), {x: cx, y: cy}));
            // Lower precision as we are raycasting using GPU depth render.
            t.ok(nearlyEquals(fixedLngLat(transform.pointLocation3D(new Point(cx, cy))), {lng: 0, lat: 0}, 0.00006));
            t.ok(nearlyEquals(fixedCoord(transform.pointCoordinate3D(new Point(cx, cy))), {x: 0.5, y: 0.5, z: 0}, 0.000001));
            t.ok(nearlyEquals(fixedPoint(transform.locationPoint3D(new LngLat(0, 0))), {x: cx, y: cy}));

            // above horizon:
            // raycast implementation returns null as there is no point at the top.
            t.equal(transform.elevation.pointCoordinate(new Point(cx, 0)), null);

            t.ok(transform.elevation.pointCoordinate(new Point(transform.width, transform.height)));
            t.deepEqual(transform.elevation.pointCoordinate(new Point(transform.width, transform.height))[2].toFixed(10), 0);

            const latLng3D = transform.pointLocation3D(new Point(cx, 0));
            const latLng2D = transform.pointLocation(new Point(cx, 0));
            // Project and get horizon line.

            const horizonPoint3D = transform.locationPoint3D(latLng3D);
            const horizonPoint2D = transform.locationPoint(latLng2D);
            t.ok(Math.abs(horizonPoint3D.x - cx) < 0.0000001);
            t.ok(Math.abs(transform.horizonLineFromTop() - 48.68884861327036) < 0.000000001);
            t.ok(Math.abs(horizonPoint3D.y - 48.68884861327036) < 0.000000001);
            t.deepEqual(horizonPoint2D, horizonPoint3D); // Using the same code path for horizon.

            // disable terrain.
            map.setTerrain(null);
            map.once('render', () => {
                t.notOk(map.painter.terrain);
                const latLng = transform.pointLocation3D(new Point(cx, 0));
                t.deepEqual(latLng, latLng2D);

                t.deepEqual(fixedLngLat(transform.pointLocation(new Point(cx, cy))), {lng: 0, lat: 0});
                t.deepEqual(fixedCoord(transform.pointCoordinate(new Point(cx, cy))), {x: 0.5, y: 0.5, z: 0});
                t.ok(nearlyEquals(fixedPoint(transform.locationPoint(new LngLat(0, 0))), {x: cx, y: cy}));
                // Higher precision as we are using the same as for 2D, given there is no terrain.
                t.ok(nearlyEquals(fixedLngLat(transform.pointLocation3D(new Point(cx, cy))), {lng: 0, lat: 0}));
                t.ok(nearlyEquals(fixedCoord(transform.pointCoordinate3D(new Point(cx, cy))), {x: 0.5, y: 0.5, z: 0}));
                t.ok(nearlyEquals(fixedPoint(transform.locationPoint3D(new LngLat(0, 0))), {x: cx, y: cy}));

                t.end();
            });
        });
    });
});

test('Negative Elevation', (t) => {
    t.beforeEach((callback) => {
        window.useFakeXMLHttpRequest();
        callback();
    });

    t.afterEach((callback) => {
        window.restore();
        callback();
    });

    const map = createMap(t, {
        style: createStyle()
    });

    const assertAlmostEqual = (t, actual, expected, epsilon = 1e-6) => {
        t.ok(Math.abs(actual - expected) < epsilon);
    };

    map.on('style.load', () => {
        map.addSource('mapbox-dem', {
            "type": "raster-dem",
            "tiles": ['http://example.com/{z}/{x}/{y}.png'],
            "tileSize": TILE_SIZE,
            "maxzoom": 14
        });
        const cache = map.style._getSourceCache('mapbox-dem');
        cache.used = cache._sourceLoaded = true;
        const mockDem = (dem, cache) => {
            cache._loadTile = (tile, callback) => {
                tile.dem = dem;
                tile.needsHillshadePrepare = true;
                tile.needsDEMTextureUpload = true;
                tile.state = 'loaded';
                callback(null);
            };
        };
        t.test('sampling with negative elevation', t => {
            mockDem(createNegativeGradientDEM(), cache);
            map.setTerrain({"source": "mapbox-dem"});
            map.once('render', () => {
                map._updateTerrain();
                t.test('negative elevation', t => {
                    const minElevation = map.painter.terrain.getMinElevationBelowMSL();
                    assertAlmostEqual(t, minElevation, -1671.55);
                    cache.clearTiles();
                    t.end();
                });
                t.end();
            });
        });

        t.test('sampling with negative elevation and exaggeration', t => {
            mockDem(createNegativeGradientDEM(), cache);
            map.setTerrain({"source": "mapbox-dem", "exaggeration": 1.5});
            map.once('render', () => {
                map._updateTerrain();
                t.test('negative elevation with exaggeration', t => {
                    const minElevation = map.painter.terrain.getMinElevationBelowMSL();
                    assertAlmostEqual(t, minElevation, -2507.325);
                    cache.clearTiles();
                    t.end();
                });
                t.end();
            });
        });

        t.test('sampling with no negative elevation', t => {
            mockDem(createGradientDEM(), cache);
            map.setTerrain({"source": "mapbox-dem"});
            map.once('render', () => {
                map._updateTerrain();
                t.test('no negative elevation', t => {
                    const minElevation = map.painter.terrain.getMinElevationBelowMSL();
                    t.deepEqual(minElevation, 0);
                    cache.clearTiles();
                    t.end();
                });
                t.end();
            });
        });
        t.end();
    });
});

test('Vertex morphing', (t) => {
    const createTile = (id) => {
        const tile = new Tile(id);
        tile.demTexture = {};
        tile.state = 'loaded';
        return tile;
    };

    t.test('Morph single tile', (t) => {
        const morphing = new VertexMorphing();
        const coord = new OverscaledTileID(2, 0, 2, 1, 1);
        const src = createTile(new OverscaledTileID(4, 0, 4, 8, 15));
        const dst = createTile(new OverscaledTileID(5, 0, 5, 8, 15));

        morphing.newMorphing(coord.key, src, dst, 0, 250);
        let values = morphing.getMorphValuesForProxy(coord.key);
        t.ok(values);

        // Initial state
        t.deepEqual(values.from, src);
        t.deepEqual(values.to, dst);
        t.equal(values.phase, 0);

        morphing.update(125);

        // Half way through
        values = morphing.getMorphValuesForProxy(coord.key);
        t.ok(values);
        t.deepEqual(values.from, src);
        t.deepEqual(values.to, dst);
        t.equal(values.phase, 0.5);

        // Done
        values = morphing.getMorphValuesForProxy(250);
        t.notOk(values);

        t.end();
    });

    t.test('Queue dem tiles', (t) => {
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
        t.ok(values);

        morphing.update(250);
        values = morphing.getMorphValuesForProxy(coord.key);
        t.ok(values);
        t.deepEqual(values.from, src);
        t.deepEqual(values.to, dst);
        t.equal(values.phase, 0.5);

        // Expect to find the `queued` tile. `intermediate` should have been discarded
        morphing.update(500);
        values = morphing.getMorphValuesForProxy(coord.key);
        t.ok(values);
        t.deepEqual(values.from, dst);
        t.deepEqual(values.to, queued);
        t.equal(values.phase, 0.0);

        morphing.update(750);
        values = morphing.getMorphValuesForProxy(coord.key);
        t.ok(values);
        t.deepEqual(values.from, dst);
        t.deepEqual(values.to, queued);
        t.equal(values.phase, 0.5);

        morphing.update(1000);
        values = morphing.getMorphValuesForProxy(coord.key);
        t.notOk(values);

        t.end();
    });

    t.test('Queue dem tiles multiple times', (t) => {
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
        t.ok(values);

        morphing.update(75);
        values = morphing.getMorphValuesForProxy(coord.key);
        t.ok(values);
        t.deepEqual(values.from, src);
        t.deepEqual(values.to, dst);
        t.equal(values.phase, 0.75);

        morphing.update(110);
        values = morphing.getMorphValuesForProxy(coord.key);
        t.notOk(values);

        t.end();
    });

    t.test('Expired data', (t) => {
        const morphing = new VertexMorphing();
        const coord = new OverscaledTileID(2, 0, 2, 1, 1);
        const src = createTile(new OverscaledTileID(4, 0, 4, 8, 15));
        const dst = createTile(new OverscaledTileID(5, 0, 5, 8, 15));
        const queued = createTile(new OverscaledTileID(6, 0, 5, 9, 16));

        morphing.newMorphing(coord.key, src, dst, 0, 1000);
        morphing.newMorphing(coord.key, dst, queued, 0, 1000);

        morphing.update(200);
        let values = morphing.getMorphValuesForProxy(coord.key);
        t.ok(values);
        t.deepEqual(values.from, src);
        t.deepEqual(values.to, dst);
        t.equal(values.phase, 0.2);

        // source tile is expired
        src.state = 'unloaded';
        morphing.update(300);
        values = morphing.getMorphValuesForProxy(coord.key);
        t.ok(values);
        t.deepEqual(values.from, dst);
        t.deepEqual(values.to, queued);
        t.equal(values.phase, 0.0);

        const newQueued = createTile(new OverscaledTileID(7, 0, 7, 9, 16));
        morphing.newMorphing(coord.key, queued, newQueued, 1000);

        // The target tile is expired. The morphing operation should be cancelled
        queued.state = 'unloaded';
        morphing.update(500);
        values = morphing.getMorphValuesForProxy(coord.key);
        t.notOk(values);

        t.end();
    });

    t.end();
});

test('Render cache efficiency', (t) => {
    t.test('Optimized for terrain, various efficiency', (t) => {
        const map = createMap(t, {
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
            },
            optimizeForTerrain: false
        });

        map.on('style.load', () => {
            const cache = map.style._getSourceCache('mapbox-dem');
            cache._loadTile = (tile, callback) => {
                const pixels = new Uint8Array((512 + 2) * (512 + 2) * 4);
                tile.dem = new DEMData(0, new RGBAImage({height: 512 + 2, width: 512 + 2}, pixels));
                tile.needsHillshadePrepare = true;
                tile.needsDEMTextureUpload = true;
                tile.state = 'loaded';
                callback(null);
            };
            map.setTerrain({'source': 'mapbox-dem'});
            map.once('render', () => {
                map._updateTerrain();
                map.addLayer({
                    'id': 'background',
                    'type': 'background'
                });

                // Stub console.warn to prevent test fail
                const warn = console.warn;
                console.warn = (_) => {};

                t.test('Cache efficiency 1', (t) => {
                    map.addLayer({
                        'id': 'undraped1',
                        'type': 'symbol',
                        'source': 'geojson'
                    });
                    const renderCacheInfo = map.painter.terrain.renderCacheEfficiency(map.painter.style);
                    t.equal(renderCacheInfo.efficiency, 100);
                    map.removeLayer('undraped1');
                    t.end();
                });

                t.test('Cache efficiency 2', (t) => {
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
                    const renderCacheInfo = map.painter.terrain.renderCacheEfficiency(map.painter.style);
                    t.equal(renderCacheInfo.efficiency, 100);
                    map.removeLayer('draped1');
                    map.removeLayer('draped2');
                    map.removeLayer('undraped1');
                    t.end();
                });

                t.test('Cache efficiency 3', (t) => {
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
                    const renderCacheInfo = map.painter.terrain.renderCacheEfficiency(map.painter.style);
                    t.equal(renderCacheInfo.efficiency, 75);
                    map.removeLayer('draped1');
                    map.removeLayer('draped2');
                    map.removeLayer('draped3');
                    map.removeLayer('undraped1');
                    t.end();
                });

                t.test('Cache efficiency 4', (t) => {
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
                    const renderCacheInfo = map.painter.terrain.renderCacheEfficiency(map.painter.style);
                    t.equal(renderCacheInfo.efficiency, 50);
                    map.removeLayer('draped1');
                    map.removeLayer('draped2');
                    map.removeLayer('draped3');
                    map.removeLayer('undraped1');
                    t.end();
                });

                console.warn = warn;

                t.end();
            });
        });
    });

    t.test('Optimized for terrain, 100% efficiency', (t) => {
        const map = createMap(t, {
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
            },
            optimizeForTerrain: true
        });

        map.on('style.load', () => {
            const cache = map.style._getSourceCache('mapbox-dem');
            cache._loadTile = (tile, callback) => {
                const pixels = new Uint8Array((512 + 2) * (512 + 2) * 4);
                tile.dem = new DEMData(0, new RGBAImage({height: 512 + 2, width: 512 + 2}, pixels));
                tile.needsHillshadePrepare = true;
                tile.needsDEMTextureUpload = true;
                tile.state = 'loaded';
                callback(null);
            };
            map.setTerrain({'source': 'mapbox-dem'});
            map.once('render', () => {
                map._updateTerrain();
                map.addLayer({
                    'id': 'background',
                    'type': 'background'
                });

                // Stub console.warn to prevent test fail
                const warn = console.warn;
                console.warn = (_) => {};

                t.test('Cache efficiency 1', (t) => {
                    map.addLayer({
                        'id': 'undraped1',
                        'type': 'symbol',
                        'source': 'geojson'
                    });
                    const renderCacheInfo = map.painter.terrain.renderCacheEfficiency(map.painter.style);
                    t.equal(renderCacheInfo.efficiency, 100);
                    map.removeLayer('undraped1');
                    t.end();
                });

                t.test('Cache efficiency 2', (t) => {
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
                    const renderCacheInfo = map.painter.terrain.renderCacheEfficiency(map.painter.style);
                    t.equal(renderCacheInfo.efficiency, 100);
                    map.removeLayer('draped1');
                    map.removeLayer('draped2');
                    map.removeLayer('undraped1');
                    t.end();
                });

                t.test('Cache efficiency 3', (t) => {
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
                    const renderCacheInfo = map.painter.terrain.renderCacheEfficiency(map.painter.style);
                    t.equal(renderCacheInfo.efficiency, 100);
                    map.removeLayer('draped1');
                    map.removeLayer('draped2');
                    map.removeLayer('draped3');
                    map.removeLayer('undraped1');
                    t.end();
                });

                t.test('Cache efficiency 4', (t) => {
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
                    const renderCacheInfo = map.painter.terrain.renderCacheEfficiency(map.painter.style);
                    t.equal(renderCacheInfo.efficiency, 100);
                    map.removeLayer('draped1');
                    map.removeLayer('draped2');
                    map.removeLayer('draped3');
                    map.removeLayer('undraped1');
                    t.end();
                });

                console.warn = warn;

                t.end();
            });
        });
    });

    t.end();
});

test('Marker interaction and raycast', (t) => {
    const map = createMap(t, {
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

    const tr = map.transform;
    const marker = new Marker({draggable: true})
        .setLngLat(tr.center)
        .addTo(map)
        .setPopup(new Popup().setHTML(`a popup content`))
        .togglePopup();
    t.equal(map.project(marker.getLngLat()).y, tr.height / 2);
    t.equal(tr.locationPoint3D(marker.getLngLat()).y, tr.height / 2);
    t.deepEqual(marker.getPopup()._pos, new Point(tr.width / 2, tr.height / 2));

    map.once('style.load', () => {
        map.addSource('mapbox-dem', {
            "type": "raster-dem",
            "tiles": ['http://example.com/{z}/{x}/{y}.png'],
            "tileSize": TILE_SIZE,
            "maxzoom": 14
        });
        map.transform._horizonShift = 0;
        const cache = map.style._getSourceCache('mapbox-dem');
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
        map.once('render', () => {
            map._updateTerrain();
            // expect no changes at center
            t.equal(map.project(marker.getLngLat()).y, tr.height / 2);
            t.equal(tr.locationPoint3D(marker.getLngLat()).y, tr.height / 2);
            t.deepEqual(marker.getPopup()._pos, new Point(tr.width / 2, tr.height / 2));

            const terrainTopLngLat = tr.pointLocation3D(new Point(tr.width / 2, 0)); // gets clamped at the top of terrain
            const terrainTop = tr.locationPoint3D(terrainTopLngLat);
            // With a bit of tweaking (given that const terrain planes are used), terrain is above horizon line.
            t.ok(terrainTop.y < tr.horizonLineFromTop() - 3);

            t.test('Drag above clamps at horizon', (t) => {
                // Offset marker down, 2 pixels under terrain top above horizon.
                const startPos = new Point(0, 2)._add(terrainTop);
                marker.setLngLat(tr.pointLocation3D(startPos));
                t.ok(Math.abs(tr.locationPoint3D(marker.getLngLat()).y - startPos.y) < 0.000001);
                const el = marker.getElement();

                simulate.mousedown(el);
                simulate.mousemove(el, {clientX: 0, clientY: -40});
                simulate.mouseup(el);

                const endPos = tr.locationPoint3D(marker.getLngLat());
                t.true(Math.abs(endPos.x - startPos.x) < 0.00000000001);
                t.equal(endPos.y, terrainTop.y);
                t.deepEqual(marker.getPopup()._pos, endPos);

                t.end();
            });

            t.test('Drag below / behind camera', (t) => {
                const startPos = new Point(terrainTop.x, tr.height - 20);
                marker.setLngLat(tr.pointLocation3D(startPos));
                t.ok(Math.abs(tr.locationPoint3D(marker.getLngLat()).y - startPos.y) < 0.000001);
                const el = marker.getElement();

                simulate.mousedown(el);
                simulate.mousemove(el, {clientX: 0, clientY: 40});
                simulate.mouseup(el);

                const endPos = tr.locationPoint3D(marker.getLngLat());
                t.equal(Math.round(endPos.y), Math.round(startPos.y) + 40);
                t.deepEqual(marker.getPopup()._pos, endPos);
                t.end();
            });

            t.test('Occluded', (t) => {
                marker._fadeTimer = null;
                marker.setLngLat(terrainTopLngLat);
                const bottomLngLat = tr.pointLocation3D(new Point(terrainTop.x, tr.height));
                // Raycast returns distance to closer point evaluates to occluded marker.
                t.stub(tr, 'pointLocation3D').returns(bottomLngLat);
                setTimeout(() => {
                    t.deepEqual(marker.getElement().style.opacity, TERRAIN_OCCLUDED_OPACITY);
                    t.end();
                }, 100);
            });

            t.end();
        });
    });
});

test('terrain getBounds', (t) => {
    const map = createMap(t, {
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
    map.once('style.load', () => {
        map.addSource('mapbox-dem', {
            "type": "raster-dem",
            "tiles": ['http://example.com/{z}/{x}/{y}.png'],
            "tileSize": TILE_SIZE,
            "maxzoom": 14
        });
        const cache = map.style._getSourceCache('mapbox-dem');
        cache.used = cache._sourceLoaded = true;
        cache._loadTile = (tile, callback) => {
            // Elevate tiles above center.
            tile.dem = createConstElevationDEM(300 * (tr.zoom - tile.tileID.overscaledZ), TILE_SIZE);
            tile.needsHillshadePrepare = true;
            tile.needsDEMTextureUpload = true;
            tile.state = 'loaded';
            callback(null);
        };

        t.deepEqual(map.getBounds().getCenter().lng.toFixed(10), 0, 'horizon, no terrain getBounds');
        t.ok(Math.abs(map.getBounds().getCenter().lat.toFixed(10) - 0.4076172064) < 0.0000001, 'horizon, no terrain getBounds');

        map.setTerrain({"source": "mapbox-dem"});
        map.once('render', () => {
            map._updateTerrain();

            // As tiles above center are elevated, center of bounds is closer to camera.
            t.deepEqual(map.getBounds().getCenter().lng.toFixed(10), 0, 'horizon terrain getBounds');
            t.deepEqual(map.getBounds().getCenter().lat.toFixed(10), -1.2344797596, 'horizon terrain getBounds');

            map.setPitch(0);
            map.once('render', () => {
                t.deepEqual(map.getBounds().getCenter().lng.toFixed(10), 0, 'terrain 0 getBounds');
                t.deepEqual(map.getBounds().getCenter().lat.toFixed(10), 0, 'terrain 0 getBounds');
                t.end();
            });
        });
    });
});
