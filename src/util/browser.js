// @flow

import window from './window';
import type { Cancelable } from '../types/cancelable';

const now = window.performance && window.performance.now ?
    window.performance.now.bind(window.performance) :
    Date.now.bind(Date);

const raf = window.requestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.msRequestAnimationFrame;

const cancel = window.cancelAnimationFrame ||
    window.mozCancelAnimationFrame ||
    window.webkitCancelAnimationFrame ||
    window.msCancelAnimationFrame;

/**
 * @private
 */
const exported = {
    /**
     * Provides a function that outputs milliseconds: either performance.now()
     * or a fallback to Date.now()
     */
    now,

    frame(fn: Function): Cancelable {
        const frame = raf(fn);
        return { cancel: () => cancel(frame) };
    },

    getImageData(img: CanvasImageSource): ImageData {
        const canvas = window.document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('failed to create canvas 2d context');
        }
        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0, img.width, img.height);
        return context.getImageData(0, 0, img.width, img.height);
    },

    resolveURL(path: string) {
        const a = window.document.createElement('a');
        a.href = path;
        return a.href;
    },

    hardwareConcurrency: window.navigator.hardwareConcurrency || 4,
    get devicePixelRatio() { return window.devicePixelRatio; },
    supportsWebp: false
};

export default exported;

if (window.document) {
    testWebp();
}

function testWebp() {
    const webpImgTest = window.document.createElement('img');
    webpImgTest.onload = function() {

        // Edge 18 supports WebP but not uploading a WebP image to a gl texture
        // Test support for this before allowing WebP images.
        // https://github.com/mapbox/mapbox-gl-js/issues/7671
        const canvas = window.document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);

        try {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, webpImgTest);
            exported.supportsWebp = true;
        } catch (e) {
            // Catch "Unspecified Error." in Edge 18.
        }

        gl.deleteTexture(texture);
        const extension = gl.getExtension('WEBGL_lose_context');
        if (extension) extension.loseContext();
    };
    webpImgTest.src = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAQAAAAfQ//73v/+BiOh/AAA=';
}
