// @flow

import Benchmark from '../lib/benchmark';
import fetchStyle from '../lib/fetch_style';
import createStyle from '../lib/create_style';
import fetchTiles from '../lib/fetch_tiles';
import parseTiles from '../lib/parse_tiles';

import { serialize } from '../../src/util/web_worker_transfer';
import StyleLayerIndex from '../../src/style/style_layer_index';
import {OverscaledTileID} from '../../src/source/tile_id';
import deref from '../../src/style-spec/deref';

export default class WorkerTransfer extends Benchmark {
    layerIndex: StyleLayerIndex;
    payload: Array<any>;
    worker: Worker;

    setup(): Promise<void> {
        this.payload = [];

        const src = `
        onmessage = (e) => {
            postMessage(e.data);
        };
        `;
        const url = window.URL.createObjectURL(new Blob([src], {type: 'text/javascript'}));
        this.worker = new Worker(url);

        const tileIDs = [
            new OverscaledTileID(12, 0, 12, 655, 1583),
            new OverscaledTileID(8, 0, 8, 40, 98),
            new OverscaledTileID(4, 0, 4, 3, 6),
            new OverscaledTileID(0, 0, 0, 0, 0)
        ];

        return fetchStyle(`mapbox://styles/mapbox/streets-v9`)
            .then((styleJSON) => {
                this.layerIndex = new StyleLayerIndex(deref(styleJSON.layers));
                return Promise.all([
                    createStyle(styleJSON),
                    fetchTiles((styleJSON.sources.composite: any).url, tileIDs)
                ]);
            })
            .then(([style, tiles]) => {
                const preloadImages = (params, callback) => {
                    style.getImages('', params, (err, icons) => {
                        this.payload.push(barePayload(icons));
                        callback(err, icons);
                    });
                };

                const preloadGlyphs = (params, callback) => {
                    style.getGlyphs('', params, (err, glyphs) => {
                        this.payload.push(barePayload(glyphs));
                        callback(err, glyphs);
                    });
                };

                return parseTiles('composite',
                                  tiles,
                                  this.layerIndex,
                                  preloadImages,
                                  preloadGlyphs);
            }).then((tileResults) => {
                for (const data of tileResults) this.payload.push(barePayload(data));
                // console.log(this.payload.map(p => JSON.stringify(p).length));
            });
    }

    sendPayload(obj: any) {
        return new Promise((resolve) => {
            this.worker.onmessage = () => resolve();
            this.worker.postMessage(obj);
        });
    }

    bench(): Promise<void> {
        let promise: Promise<void> = Promise.resolve();

        for (const obj of this.payload) {
            promise = promise.then(() => {
                return this.sendPayload(obj);
            });
        }

        return promise;
    }
}

function barePayload(obj) {
    // strip all transferables from a worker payload
    return JSON.parse(JSON.stringify(serialize(obj, []), (key, value) => ArrayBuffer.isView(value) ? {} : value));
}
