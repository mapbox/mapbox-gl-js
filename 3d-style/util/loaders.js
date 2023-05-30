// @flow
/* global document: false, self: false, mapboxglLoaders: false, importScripts: false */

import {isWorker} from '../../src/util/util.js';

let loadingPromise: Promise<any> | void;

function loadJS(url: string) {
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
        loadingPromise = loadJS(`${self.origin}/dist/mapbox-gl-loaders.js`);
        await loadingPromise;
    }

    loadingPromise = undefined;
}

export async function loadGLTF(url: string): Promise<any> {
    await waitForLoaders();
    return mapboxglLoaders.load(url, mapboxglLoaders.GLTFLoader, {
        gltf: {
            postProcess: false,
            loadBuffers: true,
            loadImages: true
        }
    });
}

export async function load3DTile(data: ArrayBuffer): Promise<any> {
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
