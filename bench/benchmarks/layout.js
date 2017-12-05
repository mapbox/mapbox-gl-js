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
const OverscaledTileID = require('../../src/source/tile_id').OverscaledTileID;

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
    tiles: Array<{tileID: OverscaledTileID, buffer: ArrayBuffer}>;

    tileIDs(): Array<OverscaledTileID> {
        return [
            new OverscaledTileID(12, 0, 12, 655, 1583),
            new OverscaledTileID(8, 0, 8, 40, 98),
            new OverscaledTileID(4, 0, 4, 3, 6),
            new OverscaledTileID(0, 0, 0, 0, 0)
        ];
    }

    sourceID(): string {
        return 'composite';
    }

    fetchStyle(): Promise<StyleSpecification> {
        return fetch(normalizeStyleURL(`mapbox://styles/mapbox/streets-v9`))
            .then(response => response.json());
    }

    fetchTiles(styleJSON: StyleSpecification): Promise<Array<{tileID: OverscaledTileID, buffer: ArrayBuffer}>> {
        const sourceURL: string = (styleJSON.sources[this.sourceID()]: any).url;
        return fetch(normalizeSourceURL(sourceURL))
            .then(response => response.json())
            .then((tileJSON: TileJSON) => {
                return Promise.all(this.tileIDs().map(tileID => {
                    return fetch((normalizeTileURL(tileID.canonical.url(tileJSON.tiles))))
                        .then(response => response.arrayBuffer())
                        .then(buffer => ({tileID, buffer}));
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

        for (const {tileID, buffer} of this.tiles) {
            promise = promise.then(() => {
                const workerTile = new WorkerTile({
                    tileID: { overscaledZ: tileID.overscaledZ, wrap: tileID.wrap, canonical: { z: tileID.canonical.z, x: tileID.canonical.x, y: tileID.canonical.y } },
                    zoom: tileID.overscaledZ,
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
