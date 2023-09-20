// @flow
/* global document: false, self: false, mapboxglLoaders: false, importScripts: false */

import config from '../../src/util/config.js';
import browser from '../../src/util/browser.js';
import Dispatcher from '../../src/util/dispatcher.js';
import getWorkerPool from '../../src/util/global_worker_pool.js';
import {Evented} from '../../src/util/evented.js';
import {isWorker, warnOnce} from '../../src/util/util.js';

let dispatcher = null;
let loadingPromise: Promise<any> | void;
let loadersUrl: ?string;

const defaultLoadersUrl = process.env.ROLLUP_WATCH ?
    `${self.origin}/dist/mapbox-gl-loaders.js` :
    config.LOADERS_URL;

export function getLoadersUrl(): string {
    if (isWorker() && self.worker && self.worker.loadersUrl) {
        return self.worker.loadersUrl;
    }

    return loadersUrl ? loadersUrl : defaultLoadersUrl;
}

export function setLoadersUrl(url: string) {
    loadersUrl = browser.resolveURL(url);

    if (!dispatcher) {
        dispatcher = new Dispatcher(getWorkerPool(), new Evented());
    }

    // Sets the loaders URL in all workers.
    dispatcher.broadcast('setLoadersUrl', loadersUrl);
}

function loadBundle(url: string) {
    if (isWorker()) {
        importScripts(url);
        return new Promise(resolve => resolve());
    }

    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = resolve;
        script.onerror = reject;
        (document.head: any).appendChild(script);
        script.src = url;
    });
}

async function waitForLoaders() {
    if (loadingPromise) await loadingPromise;

    // $FlowFixMe expecting a global variable
    if (typeof mapboxglLoaders === 'undefined') {
        const loadersUrl = getLoadersUrl();
        try {
            loadingPromise = loadBundle(loadersUrl);
            await loadingPromise;
        } catch (e) {
            warnOnce(`Could not load bundle from ${loadersUrl}.`);
        }
    }

    loadingPromise = undefined;
}

export async function loadGLTF(url: string): Promise<?Object> {
    await waitForLoaders();
    return mapboxglLoaders.load(url, mapboxglLoaders.GLTFLoader, {
        gltf: {
            postProcess: false,
            loadBuffers: true,
            loadImages: true
        }
    });
}

export async function load3DTile(data: ArrayBuffer): Promise<?Object> {
    await waitForLoaders();
    return mapboxglLoaders.parse(data, mapboxglLoaders.Tiles3DLoader, {
        worker: false,
        gltf: {
            decompressMeshes: true,
            postProcess: false,
            loadBuffers: true,
            loadImages: true
        }
    });
}
