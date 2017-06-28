// @flow

const window = require('./window');
const supported = require('mapbox-gl-supported');

/**
 * @private
 */
module.exports = {
    /**
     * Provides a function that outputs milliseconds: either performance.now()
     * or a fallback to Date.now()
     */
    now: (() => {
        if (window.performance &&
            window.performance.now) {
            return window.performance.now.bind(window.performance);
        } else {
            return Date.now.bind(Date);
        }
    })(),

    frame: (() => {
        const frame = window.requestAnimationFrame ||
            window.mozRequestAnimationFrame ||
            window.webkitRequestAnimationFrame ||
            window.msRequestAnimationFrame;

        return (fn: Function) => frame(fn);
    })(),

    cancelFrame: (() => {
        const cancel = window.cancelAnimationFrame ||
            window.mozCancelAnimationFrame ||
            window.webkitCancelAnimationFrame ||
            window.msCancelAnimationFrame;

        return (id: number) => cancel(id);
    })(),

    timed(fn: (n: number) => mixed, dur: number, ctx: mixed) {
        if (!dur) {
            fn.call(ctx, 1);
            return null;
        }

        let abort = false;
        const start = module.exports.now();

        function tick(now) {
            if (abort) return;
            now = module.exports.now();

            if (now >= start + dur) {
                fn.call(ctx, 1);
            } else {
                fn.call(ctx, (now - start) / dur);
                module.exports.frame(tick);
            }
        }

        module.exports.frame(tick);

        return function() { abort = true; };
    },

    getImageData(img: CanvasImageSource) {
        const canvas = window.document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0, img.width, img.height);
        return context.getImageData(0, 0, img.width, img.height).data;
    },

    /**
     * Test if the current browser supports Mapbox GL JS
     * @param {Object} options
     * @param {boolean} [options.failIfMajorPerformanceCaveat=false] Return `false`
     *   if the performance of Mapbox GL JS would be dramatically worse than
     *   expected (i.e. a software renderer would be used)
     * @return {boolean}
     */
    supported,

    hardwareConcurrency: window.navigator.hardwareConcurrency || 4,

    get devicePixelRatio() { return window.devicePixelRatio; },

    supportsWebp: false
};

const webpImgTest = window.document.createElement('img');
webpImgTest.onload = function() {
    module.exports.supportsWebp = true;
};
webpImgTest.src = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAQAAAAfQ//73v/+BiOh/AAA=';
