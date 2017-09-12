// @flow

'use strict';

const VT = require('@mapbox/vector-tile');
const Protobuf = require('pbf');
const assert = require('assert');
const promisify = require('pify');

const Benchmark = require('../benchmark');
const WorkerTile = require('../../src/source/worker_tile');
const Style = require('../../src/style/style');
const StyleLayerIndex = require('../../src/style/style_layer_index');
const Evented = require('../../src/util/evented');
const config = require('../../src/util/config');
const coordinates = require('../lib/coordinates');
const accessToken = require('../lib/access_token');
const deref = require('../../src/style-spec/deref');

const SAMPLE_COUNT = 10;
config.ACCESS_TOKEN = accessToken;

/**
 * Individual files may export a single class deriving from `Benchmark`, or a "benchmark suite" consisting
 * of an array of such classes.
 */
module.exports = coordinates.map((coordinate) => {
    return class BufferBenchmark extends Benchmark {
        glyphs: Object;
        icons: Object;
        workerTile: WorkerTile;
        layerIndex: StyleLayerIndex;
        tileBuffer: ArrayBuffer;

        get name() { return `Tile Parsing ${coordinate.zoom}/${coordinate.row}/${coordinate.column}`; }

        setup() {
            this.glyphs = {};
            this.icons = {};

            this.workerTile = new WorkerTile({
                coord: coordinate,
                zoom: coordinate.zoom,
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

            const styleURL = `https://api.mapbox.com/styles/v1/mapbox/streets-v9?access_token=${accessToken}`;
            const tileURL = `https://a.tiles.mapbox.com/v4/mapbox.mapbox-terrain-v2,mapbox.mapbox-streets-v6/${coordinate.zoom}/${coordinate.row}/${coordinate.column}.vector.pbf?access_token=${accessToken}`;

            return Promise.all([
                fetch(styleURL).then(response => response.json()),
                fetch(tileURL).then(response => response.arrayBuffer())
            ]).then(([styleJSON, tileBuffer]) => {
                return new Promise((resolve, reject) => {
                    this.layerIndex = new StyleLayerIndex(deref(styleJSON.layers));
                    this.tileBuffer = tileBuffer;

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

            const tile = new VT.VectorTile(new Protobuf(this.tileBuffer));
            const parse = promisify(this.workerTile.parse.bind(this.workerTile));

            return parse(tile, this.layerIndex, actor);
        }
    }
});

class StubMap extends Evented {
    _transformRequest(url) {
        return { url };
    }
}
