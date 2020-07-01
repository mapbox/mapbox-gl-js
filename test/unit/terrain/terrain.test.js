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

        const map = createMap(t);
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
                tile.dem = zeroDem;
                tile.needsHillshadePrepare = true;
                tile.needsDEMTextureUpload = true;
                tile.state = 'loaded';
                callback(null);
            };
            map.setTerrain({"source": "mapbox-dem"});
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
