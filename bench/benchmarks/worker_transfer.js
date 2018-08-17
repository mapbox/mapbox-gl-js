// @flow

import Layout from './layout';
import { serialize } from '../../src/util/web_worker_transfer';

export default class WorkerTransfer extends Layout {
    payload: Array<any>;
    worker: Worker;

    setup(): Promise<void> {
        this.payload = [];
        const promise = super.setup();

        const src = `
        onmessage = (e) => {
            postMessage(e.data);
        };
        `;
        const url = window.URL.createObjectURL(new Blob([src], {type: 'text/javascript'}));
        this.worker = new Worker(url);

        return promise.then(() => {
            for (const key in this.glyphs) this.payload.push(barePayload(this.glyphs[key]));
            for (const key in this.icons) this.payload.push(barePayload(this.icons[key]));
            // console.log(this.payload.map(p => JSON.stringify(p).length));
        });
    }

    onTileParse(data: any) {
        this.payload.push(barePayload(data));
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
