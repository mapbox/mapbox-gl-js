import {test} from '../../util/test';
import {extend} from '../../../src/util/util';
import {createMap} from '../../util';
import DEMData from '../../../src/data/dem_data';
import {RGBAImage} from '../../../src/util/image';
import MercatorCoordinate from '../../../src/geo/mercator_coordinate';
import window from '../../../src/util/window';
import {OverscaledTileID} from '../../../src/source/tile_id';

function createStyle() {
    return {
        version: 8,
        center: [180, 0],
        zoom: 12,
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

                t.end();
            });
        });
    });
    t.end();
});
