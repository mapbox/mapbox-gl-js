// @flow

import Benchmark from '../lib/benchmark';
import fetchStyle from '../lib/fetch_style';
import TileParser from '../lib/tile_parser';
import { OverscaledTileID } from '../../src/source/tile_id';
import { serialize } from '../../src/util/web_worker_transfer';
import { values } from '../../src/util/util';

export default class WorkerTransfer extends Benchmark {
    parser: TileParser;
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
                this.parser = new TileParser(styleJSON, 'composite');
                return this.parser.setup();
            })
            .then(() => {
                return Promise.all(tileIDs.map(tileID => this.parser.fetchTile(tileID)));
            })
            .then((tiles) => {
                return Promise.all(tiles.map(tile => this.parser.parseTile(tile)));
            }).then((tileResults) => {
                this.payload = tileResults.map(barePayload)
                    .concat(values(this.parser.icons).map(barePayload))
                    .concat(values(this.parser.glyphs).map(barePayload));
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
    // strip all transferables from a worker payload, because we can't transfer them repeatedly in the bench:
    // as soon as it's transfered once, it's no longer available on the main thread
    const str = JSON.stringify(serialize(obj, []), (key, value) => ArrayBuffer.isView(value) ? {} : value);
    return JSON.parse(str);
}
