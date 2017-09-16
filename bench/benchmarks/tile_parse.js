// @flow

'use strict';

const VT = require('@mapbox/vector-tile');
const Protobuf = require('pbf');
const assert = require('assert');
const promisify = require('pify');

const WorkerTile = require('../../src/source/worker_tile');
const Style = require('../../src/style/style');
const StyleLayerIndex = require('../../src/style/style_layer_index');
const Evented = require('../../src/util/evented');
const config = require('../../src/util/config');
const deref = require('../../src/style-spec/deref');
const TileCoord = require('../../src/source/tile_coord');

const Benchmark = require('../lib/benchmark');
const accessToken = require('../lib/access_token');
config.ACCESS_TOKEN = accessToken;

const coordinates = [
    new TileCoord(15, 5242, 12665),
    new TileCoord(14, 2620, 6332),
    new TileCoord(13, 1309, 3167),
    new TileCoord(12, 655, 1583),
    new TileCoord(11, 327, 790),
    new TileCoord(10, 163, 395),
    new TileCoord(9, 81, 197),
    new TileCoord(8, 40, 98),
    new TileCoord(7, 19, 50),
    new TileCoord(6, 9, 23),
    new TileCoord(5, 4, 11),
    new TileCoord(4, 3, 6),
    new TileCoord(3, 0, 3),
    new TileCoord(2, 1, 2),
    new TileCoord(1, 1, 1),
    new TileCoord(0, 0, 0)
];

module.exports = class TileParsing extends Benchmark {
    glyphs: Object;
    icons: Object;
    workerTile: WorkerTile;
    layerIndex: StyleLayerIndex;
    tiles: Array<{coord: TileCoord, buffer: ArrayBuffer}>;

    setup() {
        this.glyphs = {};
        this.icons = {};

        const fetchStyle = fetch(`https://api.mapbox.com/styles/v1/mapbox/streets-v9?access_token=${accessToken}`)
            .then(response => response.json());

        const fetchTiles = Promise.all(coordinates.map(coord => {
            return fetch(coord.url([`https://a.tiles.mapbox.com/v4/mapbox.mapbox-terrain-v2,mapbox.mapbox-streets-v6/{z}/{x}/{y}.mvt?access_token=${accessToken}`]))
                .then(response => response.arrayBuffer())
                .then(buffer => ({coord, buffer}));
        }));

        return Promise.all([fetchStyle, fetchTiles]).then(([styleJSON, tiles]) => {
            return new Promise((resolve, reject) => {
                this.layerIndex = new StyleLayerIndex(deref(styleJSON.layers));
                this.tiles = tiles;

                const style = new Style(styleJSON, (new StubMap(): any), {})
                    .on('error', reject)
                    .on('data', () => {
                        const preloadGlyphs = (params, callback) => {
                            style.getGlyphs(0, params, (err, glyphs) => {
                                this.glyphs[JSON.stringify(params)] = glyphs;
                                callback(err, glyphs);
                            });
                        };

                        const preloadImages = (params, callback) => {
                            style.getImages(0, params, (err, icons) => {
                                this.icons[JSON.stringify(params)] = icons;
                                callback(err, icons);
                            });
                        };

                        this.bench(preloadGlyphs, preloadImages)
                            .then(resolve, reject);
                    });
            });
        });
    }

    bench(getGlyphs = (params, callback) => callback(null, this.glyphs[JSON.stringify(params)]),
          getImages = (params, callback) => callback(null, this.icons[JSON.stringify(params)])) {

        const actor = {
            send(action, params, callback) {
                setTimeout(() => {
                    if (action === 'getImages') {
                        getImages(params, callback);
                    } else if (action === 'getGlyphs') {
                        getGlyphs(params, callback);
                    } else assert(false);
                }, 0);
            }
        };

        let promise: Promise<void> = Promise.resolve();

        for (const {coord, buffer} of this.tiles) {
            promise = promise.then(() => {
                const workerTile = new WorkerTile({
                    coord,
                    zoom: coord.z,
                    tileSize: 512,
                    overscaling: 1,
                    showCollisionBoxes: false,
                    source: 'composite',
                    uid: '0',
                    maxZoom: 22,
                    pixelRatio: 1,
                    request: {
                        url: ''
                    },
                    angle: 0,
                    pitch: 0,
                    cameraToCenterDistance: 0,
                    cameraToTileDistance: 0
                });

                const tile = new VT.VectorTile(new Protobuf(buffer));
                const parse = promisify(workerTile.parse.bind(workerTile));

                return parse(tile, this.layerIndex, actor);
            });
        }

        return promise;
    }
};

class StubMap extends Evented {
    _transformRequest(url) {
        return { url };
    }
}
