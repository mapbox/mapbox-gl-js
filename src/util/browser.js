// @flow

const window = require('./window');

const now = window.performance && window.performance.now ?
    window.performance.now.bind(window.performance) :
    Date.now.bind(Date);

const frame = window.requestAnimationFrame ||
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
module.exports = {
    /**
     * Provides a function that outputs milliseconds: either performance.now()
     * or a fallback to Date.now()
     */
    now,

    frame(fn: Function) {
        return frame(fn);
    },

    cancelFrame(id: number) {
        return cancel(id);
    },

    timed(fn: (n: number) => mixed, dur: number, ctx: mixed) {
        if (!dur) {
            fn.call(ctx, 1);
            return null;
        }

        let abort = false;
        const start = now();

        function tick() {
            if (abort) return;
            const end = now();
            if (end >= start + dur) {
                fn.call(ctx, 1);
            } else {
                fn.call(ctx, (end - start) / dur);
                frame(tick);
            }
        }

        frame(tick);

        return function() { abort = true; };
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

    hardwareConcurrency: window.navigator.hardwareConcurrency || 4,

    get devicePixelRatio() { return window.devicePixelRatio; },

    supportsWebp: false
};

const webpImgTest = window.document.createElement('img');
webpImgTest.onload = function() {
    module.exports.supportsWebp = true;
};
webpImgTest.src = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAQAAAAfQ//73v/+BiOh/AAA=';
