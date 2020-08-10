import {test} from '../../util/test';
import {extend} from '../../../src/util/util';
import {createMap} from '../../util';
import DEMData from '../../../src/data/dem_data';
import {RGBAImage} from '../../../src/util/image';
import MercatorCoordinate from '../../../src/geo/mercator_coordinate';
import window from '../../../src/util/window';
import {OverscaledTileID} from '../../../src/source/tile_id';
import styleSpec from '../../../src/style-spec/reference/latest';
import Terrain from '../../../src/style/terrain';
import Tile from '../../../src/source/tile';
import {VertexMorphing} from '../../../src/terrain/draw_terrain_raster';
import {fixedLngLat, fixedCoord, fixedPoint} from '../../util/fixed';
import Point from '@mapbox/point-geometry';
import LngLat from '../../../src/geo/lng_lat';

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

// Dem texture with 0m elevation
const pixelCount = (TILE_SIZE + 2) * (TILE_SIZE + 2);
const pixelData = new Uint8Array(pixelCount * 4);

for (let i = 0; i < pixelCount * 4; i += 4) {
    pixelData[i + 0] = 1;
    pixelData[i + 1] = 134;
    pixelData[i + 2] = 160;
    pixelData[i + 3] = 0;
}
const zeroDem = new DEMData(0, new RGBAImage({height: TILE_SIZE + 2, width: TILE_SIZE + 2}, pixelData));

const setZeroElevationTerrain = (map) => {
    map.addSource('mapbox-dem', {
        "type": "raster-dem",
        "tiles": ['http://example.com/{z}/{x}/{y}.png'],
        "tileSize": TILE_SIZE,
        "maxzoom": 14
    });
    const cache = map.style.sourceCaches['mapbox-dem'];
    cache.used = cache._sourceLoaded = true;
    cache._loadTile = (tile, callback) => {
        tile.dem = zeroDem;
        tile.needsHillshadePrepare = true;
        tile.needsDEMTextureUpload = true;
        tile.state = 'loaded';
        callback(null);
    };
    map.setTerrain({"source": "mapbox-dem"});
};

test('Elevation', (t) => {

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
    const dem = new DEMData(0, new RGBAImage({height: TILE_SIZE + 2, width: TILE_SIZE + 2}, pixels));

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
            setZeroElevationTerrain(map);
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
            setZeroElevationTerrain(map);
            map.once('render', () => {
                const elevationError = -1;
                t.test('Disabled if style update removes terrain DEM source', t => {
                    const terrain = map.painter.terrain;
                    const elevation1 = map.painter.terrain.getAtPoint({x: 0.5, y: 0.5}, elevationError);
                    t.equal(elevation1, 0);

                    t.stub(console, 'warn');
                    map.setStyle(createStyle());
                    const elevation2 = terrain.getAtPoint({x: 0.5, y: 0.5}, elevationError);
                    t.ok(console.warn.calledOnce);
                    t.ok(console.warn.getCall(0).calledWithMatch(/Terrain source "mapbox-dem" is not defined./));
                    t.equal(elevation2, elevationError);

                    // Add terrain back.
                    setZeroElevationTerrain(map);

                    map.painter.updateTerrain(map.style);
                    const elevation3 = terrain.getAtPoint({x: 0.5, y: 0.5}, elevationError);
                    t.equal(elevation3, 0);

                    t.test('remove source', t => {
                        t.stub(console, 'warn');
                        map.removeSource('mapbox-dem');
                        const elevation2 = terrain.getAtPoint({x: 0.5, y: 0.5}, elevationError);
                        t.equal(elevation2, elevationError);
                        t.ok(console.warn.calledOnce);
                        t.ok(console.warn.getCall(0).calledWithMatch(/Terrain source "mapbox-dem" is not defined./));

                        setZeroElevationTerrain(map);

                        map.painter.updateTerrain(map.style);
                        const elevation3 = terrain.getAtPoint({x: 0.5, y: 0.5}, elevationError);
                        t.equal(elevation3, 0);
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
            setZeroElevationTerrain(map);
            map.once('render', () => {
                map.painter.updateTerrain(map.style);
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
            const cache = map.style.sourceCaches['mapbox-dem'];
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
                const cache = map.style.sourceCaches['mapbox-dem'];

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
            setZeroElevationTerrain(map);
            const source = map.getSource('trace');
            data.features[0].geometry.coordinates = [
                [180, 0],
                [180.1, 0],
                [180.2, 0.1]
            ];
            source.setData(data);
            t.equal(source.loaded(), false);
            source.once('data', (_) => {
                t.equal(map.getSource('trace').loaded(), true);
                let beganRenderingContent = false;
                map.on('render', () => {
                    const pixels = map.painter.canvasCopy();
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
            const cache = map.style.sourceCaches['mapbox-dem'];
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
            map.painter.updateTerrain(map.style);
            map.once('render', () => {
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

    t.test('Validate exaggeration', (t) => {
        const terrain = new Terrain({});
        const spy = t.spy(terrain, '_validate');
        t.stub(console, 'error');
        terrain.set({exaggeration: -1000});
        terrain.updateTransitions({transition: false}, {});
        terrain.recalculate({zoom: 16, zoomHistory: {}, now: 10});
        t.ok(spy.calledOnce);
        t.ok(console.error.calledOnce);
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
            layers: [],
            pitch: 80
        }
    });
    map.once('style.load', () => {
        setZeroElevationTerrain(map);
        map.once('render', () => {
            map.painter.updateTerrain(map.style);

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
