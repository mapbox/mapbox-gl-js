// @flow

const Benchmark = require('../lib/benchmark');
const createStyle = require('../lib/create_style');

const VT = require('@mapbox/vector-tile');
const Protobuf = require('pbf');
const assert = require('assert');
const promisify = require('pify');

const WorkerTile = require('../../src/source/worker_tile');
const StyleLayerIndex = require('../../src/style/style_layer_index');
const deref = require('../../src/style-spec/deref');
const TileCoord = require('../../src/source/tile_coord');
const {
    normalizeStyleURL,
    normalizeSourceURL,
    normalizeTileURL
} = require('../../src/util/mapbox');

import type {TileJSON} from '../../src/types/tilejson';

// Note: this class is extended in turn by the LayoutDDS benchmark.
module.exports = class Layout extends Benchmark {
    glyphs: Object;
    icons: Object;
    workerTile: WorkerTile;
    layerIndex: StyleLayerIndex;
    tiles: Array<{coord: TileCoord, buffer: ArrayBuffer}>;

    tileCoords(): Array<TileCoord> {
        return [
            new TileCoord(12, 655, 1583),
            new TileCoord(8, 40, 98),
            new TileCoord(4, 3, 6),
            new TileCoord(0, 0, 0)
        ];
    }

    sourceID(): string {
        return 'composite';
    }

    fetchStyle(): Promise<StyleSpecification> {
        return fetch(normalizeStyleURL(`mapbox://styles/mapbox/streets-v9`))
            .then(response => response.json());
    }

    fetchTiles(styleJSON: StyleSpecification): Promise<Array<{coord: TileCoord, buffer: ArrayBuffer}>> {
        const sourceURL: string = (styleJSON.sources[this.sourceID()]: any).url;
        return fetch(normalizeSourceURL(sourceURL))
            .then(response => response.json())
            .then((tileJSON: TileJSON) => {
                return Promise.all(this.tileCoords().map(coord => {
                    return fetch((normalizeTileURL(coord.url(tileJSON.tiles))))
                        .then(response => response.arrayBuffer())
                        .then(buffer => ({coord, buffer}));
                }));
            });
    }

    setup(): Promise<void> {
        return this.fetchStyle()
            .then((styleJSON) => {
                this.layerIndex = new StyleLayerIndex(deref(styleJSON.layers));
                return Promise.all([createStyle(styleJSON), this.fetchTiles(styleJSON)]);
            })
            .then(([style, tiles]) => {
                this.tiles = tiles;
                this.glyphs = {};
                this.icons = {};

                const preloadGlyphs = (params, callback) => {
                    style.getGlyphs('', params, (err, glyphs) => {
                        this.glyphs[JSON.stringify(params)] = glyphs;
                        callback(err, glyphs);
                    });
                };

                const preloadImages = (params, callback) => {
                    style.getImages('', params, (err, icons) => {
                        this.icons[JSON.stringify(params)] = icons;
                        callback(err, icons);
                    });
                };

                return this.bench(preloadGlyphs, preloadImages);
            });
    }

    bench(getGlyphs: Function = (params, callback) => callback(null, this.glyphs[JSON.stringify(params)]),
          getImages: Function = (params, callback) => callback(null, this.icons[JSON.stringify(params)])) {

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
                    source: this.sourceID(),
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
