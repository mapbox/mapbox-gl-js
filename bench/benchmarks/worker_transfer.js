// @flow

import type {StyleSpecification} from '../../src/style-spec/types';
import Benchmark from '../lib/benchmark';
import fetchStyle from '../lib/fetch_style';
import TileParser from '../lib/tile_parser';
import { OverscaledTileID } from '../../src/source/tile_id';
import { serialize, deserialize } from '../../src/util/web_worker_transfer';
import { values } from '../../src/util/util';

export default class WorkerTransfer extends Benchmark {
    parser: TileParser;
    payloadTiles: Array<any>;
    payloadJSON: Array<any>;
    worker: Worker;
    style: string | StyleSpecification;

    constructor(style: string | StyleSpecification) {
        super();
        this.style = style;
    }

    setup(): Promise<void> {
        const src = `
        onmessage = (e) => {
            postMessage(e.data);
        };
        `;
        const url = window.URL.createObjectURL(new Blob([src], {type: 'text/javascript'}));
        this.worker = new Worker(url);

        const tileIDs = [
            new OverscaledTileID(8, 0, 8, 73, 97),
            new OverscaledTileID(11, 0, 11, 585, 783),
            new OverscaledTileID(11, 0, 11, 596, 775),
            new OverscaledTileID(13, 0, 13, 2412, 3079)
        ];

        return fetchStyle(this.style)
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
                const payload = tileResults
                    .concat(values(this.parser.icons))
                    .concat(values(this.parser.glyphs)).map((obj) => serialize(obj, []));
                this.payloadJSON = payload.map(barePayload);
                this.payloadTiles = payload.slice(0, tileResults.length);
            });
    }

    sendPayload(obj: any): Promise<void> {
        return new Promise((resolve) => {
            this.worker.onmessage = () => resolve();
            this.worker.postMessage(obj);
        });
    }

    bench(): Promise<void> {
        let promise: Promise<void> = Promise.resolve();

        // benchmark sending raw JSON payload
        for (const obj of this.payloadJSON) {
            promise = promise.then(() => {
                return this.sendPayload(obj);
            });
        }

        return promise.then(() => {
            // benchmark deserializing full tile payload because it happens on the main thread
            for (const obj of this.payloadTiles) {
                deserialize(obj);
            }
        });
    }
}

function barePayload(obj) {
    // strip all transferables from a worker payload, because we can't transfer them repeatedly in the bench:
    // as soon as it's transfered once, it's no longer available on the main thread
    return JSON.parse(JSON.stringify(obj, (key, value) => ArrayBuffer.isView(value) ? {} : value));
}
