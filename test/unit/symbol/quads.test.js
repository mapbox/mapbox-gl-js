import { test } from 'mapbox-gl-js-test';
import { getIconQuads } from '../../../src/symbol/quads';
import Anchor from '../../../src/symbol/anchor';
import SymbolStyleLayer from '../../../src/style/style_layer/symbol_style_layer';

function createLayer(layer) {
    const result = new SymbolStyleLayer(layer);
    result.recalculate({zoom: 0, zoomHistory: {}});
    return result;
}

function createShapedIcon() {
    return {
        top: -5,
        bottom: 6,
        left: -7,
        right: 8,
        image: {
            pixelRatio: 1,
            textureRect: { x: 1, y: 1, w: 15, h: 11}
        }
    };
}

test('getIconQuads', (t) => {

    t.test('point', (t) => {
        const anchor = new Anchor(2, 3, 0, undefined);
        const layer = createLayer({
            layout: {'icon-rotate': 0}
        });
        t.deepEqual(getIconQuads(anchor, createShapedIcon(), layer, false), [
            {
                tl: { x: -8, y: -6 },
                tr: { x: 9, y: -6 },
                bl: { x: -8, y: 7 },
                br: { x: 9, y: 7 },
                tex: {  x: 0, y: 0, w: 17, h: 13 },
                writingMode: null,
                glyphOffset: [0, 0]
            }]);
        t.end();
    });

    t.test('line', (t) => {
        const anchor = new Anchor(2, 3, 0, 0);
        const layer = createLayer({
            layout: {'icon-rotate': 0}
        });
        t.deepEqual(getIconQuads(anchor, createShapedIcon(), layer, false), [
            {
                tl: { x: -8, y: -6 },
                tr: { x: 9, y: -6 },
                bl: { x: -8, y: 7 },
                br: { x: 9, y: 7 },
                tex: { x: 0, y: 0, w: 17, h: 13 },
                writingMode: null,
                glyphOffset: [0, 0]
            }]);
        t.end();
    });
    t.end();
});

test('getIconQuads text-fit', (t) => {
    const anchor = new Anchor(0, 0, 0, undefined);
    function createShapedIcon() {
        return {
            top: -10,
            bottom: 10,
            left: -10,
            right: 10,
            image: {
                pixelRatio: 1,
                textureRect: {  x: 1, y: 1, w: 20, h: 20 }
            }
        };
    }

    function createshapedText() {
        return {
            top: -10,
            bottom: 30,
            left: -60,
            right: 20
        };
    }

    t.test('icon-text-fit: none', (t) => {
        const quads = getIconQuads(anchor, createShapedIcon(), createLayer({
            layout: {
                'icon-text-fit': 'none'
            }
        }), false, createshapedText());
        t.deepEqual(quads[0].tl, { x: -11, y: -11 });
        t.deepEqual(quads[0].tr, { x: 11, y: -11 });
        t.deepEqual(quads[0].bl, { x: -11, y: 11 });
        t.deepEqual(quads[0].br, { x: 11, y: 11 });

        t.deepEqual(quads, getIconQuads(anchor, createShapedIcon(), createLayer({
            layout: {
                'icon-text-fit': 'none',
                'icon-text-fit-padding': [10, 10]
            }
        }), false, createshapedText()), 'ignores padding');

        t.end();
    });

    t.test('icon-text-fit: width', (t) => {
        // - Uses text width
        // - Preserves icon height, centers vertically
        const quads = getIconQuads(anchor, createShapedIcon(), createLayer({
            layout: {
                'text-size': 24,
                'icon-text-fit': 'width',
                'icon-text-fit-padding': [ 0, 0, 0, 0 ]
            }
        }), false, createshapedText());
        t.deepEqual(quads[0].tl, { x: -60, y: -1 });
        t.deepEqual(quads[0].tr, { x: 20, y: -1 });
        t.deepEqual(quads[0].bl, { x: -60, y: 21 });
        t.deepEqual(quads[0].br, { x: 20, y: 21 });
        t.end();
    });

    t.test('icon-text-fit: width, x textSize', (t) => {
        // - Uses text width (adjusted for textSize)
        // - Preserves icon height, centers vertically
        const quads = getIconQuads(anchor, createShapedIcon(), createLayer({
            layout: {
                'text-size': 12,
                'icon-text-fit': 'width',
                'icon-text-fit-padding': [ 0, 0, 0, 0 ]
            }
        }), false, createshapedText());
        t.deepEqual(quads[0].tl, { x: -30, y: -6 });
        t.deepEqual(quads[0].tr, { x: 10, y: -6 });
        t.deepEqual(quads[0].bl, { x: -30, y: 16 });
        t.deepEqual(quads[0].br, { x: 10, y: 16 });
        t.end();
    });

    t.test('icon-text-fit: width, x textSize, + padding', (t) => {
        // - Uses text width (adjusted for textSize)
        // - Preserves icon height, centers vertically
        // - Applies padding x, padding y
        const quads = getIconQuads(anchor, createShapedIcon(), createLayer({
            layout: {
                'text-size': 12,
                'icon-text-fit': 'width',
                'icon-text-fit-padding': [ 5, 10, 5, 10 ]
            }
        }), false, createshapedText());
        t.deepEqual(quads[0].tl, { x: -40, y: -11 });
        t.deepEqual(quads[0].tr, { x: 20, y: -11 });
        t.deepEqual(quads[0].bl, { x: -40, y: 21 });
        t.deepEqual(quads[0].br, { x: 20, y: 21 });
        t.end();
    });

    t.test('icon-text-fit: height', (t) => {
        // - Uses text height
        // - Preserves icon width, centers horizontally
        const quads = getIconQuads(anchor, createShapedIcon(), createLayer({
            layout: {
                'text-size': 24,
                'icon-text-fit': 'height',
                'icon-text-fit-padding': [ 0, 0, 0, 0 ]
            }
        }), false, createshapedText());
        t.deepEqual(quads[0].tl, { x: -31, y: -10 });
        t.deepEqual(quads[0].tr, { x: -9, y: -10 });
        t.deepEqual(quads[0].bl, { x: -31, y: 30 });
        t.deepEqual(quads[0].br, { x: -9, y: 30 });
        t.end();
    });

    t.test('icon-text-fit: height, x textSize', (t) => {
        // - Uses text height (adjusted for textSize)
        // - Preserves icon width, centers horizontally
        const quads = getIconQuads(anchor, createShapedIcon(), createLayer({
            layout: {
                'text-size': 12,
                'icon-text-fit': 'height',
                'icon-text-fit-padding': [ 0, 0, 0, 0 ]
            }
        }), false, createshapedText());
        t.deepEqual(quads[0].tl, { x: -21, y: -5 });
        t.deepEqual(quads[0].tr, { x: 1, y: -5 });
        t.deepEqual(quads[0].bl, { x: -21, y: 15 });
        t.deepEqual(quads[0].br, { x: 1, y: 15 });
        t.end();
    });

    t.test('icon-text-fit: height, x textSize, + padding', (t) => {
        // - Uses text height (adjusted for textSize)
        // - Preserves icon width, centers horizontally
        // - Applies padding x, padding y
        const quads = getIconQuads(anchor, createShapedIcon(), createLayer({
            layout: {
                'text-size': 12,
                'icon-text-fit': 'height',
                'icon-text-fit-padding': [ 5, 10, 5, 10 ]
            }
        }), false, createshapedText());
        t.deepEqual(quads[0].tl, { x: -31, y: -10 });
        t.deepEqual(quads[0].tr, { x: 11, y: -10 });
        t.deepEqual(quads[0].bl, { x: -31, y: 20 });
        t.deepEqual(quads[0].br, { x: 11, y: 20 });
        t.end();
    });

    t.test('icon-text-fit: both', (t) => {
        // - Uses text width + height
        const quads = getIconQuads(anchor, createShapedIcon(), createLayer({
            layout: {
                'text-size': 24,
                'icon-text-fit': 'both',
                'icon-text-fit-padding': [ 0, 0, 0, 0 ]
            }
        }), false, createshapedText());
        t.deepEqual(quads[0].tl, { x: -60, y: -10 });
        t.deepEqual(quads[0].tr, { x: 20, y: -10 });
        t.deepEqual(quads[0].bl, { x: -60, y: 30 });
        t.deepEqual(quads[0].br, { x: 20, y: 30 });
        t.end();
    });

    t.test('icon-text-fit: both, x textSize', (t) => {
        // - Uses text width + height (adjusted for textSize)
        const quads = getIconQuads(anchor, createShapedIcon(), createLayer({
            layout: {
                'text-size': 12,
                'icon-text-fit': 'both',
                'icon-text-fit-padding': [ 0, 0, 0, 0 ]
            }
        }), false, createshapedText());
        t.deepEqual(quads[0].tl, { x: -30, y: -5 });
        t.deepEqual(quads[0].tr, { x: 10, y: -5 });
        t.deepEqual(quads[0].bl, { x: -30, y: 15 });
        t.deepEqual(quads[0].br, { x: 10, y: 15 });
        t.end();
    });

    t.test('icon-text-fit: both, x textSize, + padding', (t) => {
        // - Uses text width + height (adjusted for textSize)
        // - Applies padding x, padding y
        const quads = getIconQuads(anchor, createShapedIcon(), createLayer({
            layout: {
                'text-size': 12,
                'icon-text-fit': 'both',
                'icon-text-fit-padding': [ 5, 10, 5, 10 ]
            }
        }), false, createshapedText());
        t.deepEqual(quads[0].tl, { x: -40, y: -10 });
        t.deepEqual(quads[0].tr, { x: 20, y: -10 });
        t.deepEqual(quads[0].bl, { x: -40, y: 20 });
        t.deepEqual(quads[0].br, { x: 20, y: 20 });
        t.end();
    });

    t.test('icon-text-fit: both, padding t/r/b/l', (t) => {
        // - Uses text width + height (adjusted for textSize)
        // - Applies padding t/r/b/l
        const quads = getIconQuads(anchor, createShapedIcon(), createLayer({
            layout: {
                'text-size': 12,
                'icon-text-fit': 'both',
                'icon-text-fit-padding': [ 0, 5, 10, 15 ]
            }
        }), false, createshapedText());
        t.deepEqual(quads[0].tl, { x: -45, y: -5 });
        t.deepEqual(quads[0].tr, { x: 15, y: -5 });
        t.deepEqual(quads[0].bl, { x: -45, y: 25 });
        t.deepEqual(quads[0].br, { x: 15, y: 25 });
        t.end();
    });

    t.end();
});
