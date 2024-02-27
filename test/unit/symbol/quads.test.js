import {describe, test, expect} from "../../util/vitest.js";
import {getIconQuads} from '../../../src/symbol/quads.js';

describe('getIconQuads', () => {
    const imagePrimary = Object.freeze({
        pixelRatio: 1,
        displaySize: Object.freeze([ 15, 11 ]),
        paddedRect: Object.freeze({x: 0, y: 0, w: 17, h: 13})
    });

    test('point', () => {
        expect(getIconQuads({
            top: -5.5,
            right: 7.5,
            bottom: 5.5,
            left: -7.5,
            imagePrimary
        }, 0, true)).toEqual([{
            tl: {x: -8.5, y: -6.5},
            tr: {x: 8.5, y: -6.5},
            bl: {x: -8.5, y: 6.5},
            br: {x: 8.5, y: 6.5},
            texPrimary: {x: 0, y: 0, w: 17, h: 13},
            texSecondary: undefined,
            writingMode: undefined,
            glyphOffset: [0, 0],
            isSDF: true,
            sectionIndex: 0,
            minFontScaleX: 0,
            minFontScaleY: 0,
            pixelOffsetBR: {
                x: 0,
                y: 0
            },
            pixelOffsetTL: {
                x: 0,
                y: 0
            }
        }]);

        expect(getIconQuads({
            top: -11,
            right: 15,
            bottom: 11,
            left: -15,
            imagePrimary
        }, 0, false)).toEqual([{
            tl: {x: -17, y: -13},
            tr: {x: 17, y: -13},
            bl: {x: -17, y: 13},
            br: {x: 17, y: 13},
            texPrimary: {x: 0, y: 0, w: 17, h: 13},
            texSecondary: undefined,
            writingMode: undefined,
            glyphOffset: [0, 0],
            isSDF: false,
            sectionIndex: 0,
            minFontScaleX: 0,
            minFontScaleY: 0,
            pixelOffsetBR: {
                x: 0,
                y: 0
            },
            pixelOffsetTL: {
                x: 0,
                y: 0
            }
        }]);

        expect(getIconQuads({
            top: 0,
            right: 0,
            bottom: 11,
            left: -15,
            imagePrimary
        }, 0, false)).toEqual([{
            tl: {x: -16, y: -1},
            tr: {x: 1, y: -1},
            bl: {x: -16, y: 12},
            br: {x: 1, y: 12},
            texPrimary: {x: 0, y: 0, w: 17, h: 13},
            texSecondary: undefined,
            writingMode: undefined,
            glyphOffset: [0, 0],
            isSDF: false,
            sectionIndex: 0,
            minFontScaleX: 0,
            minFontScaleY: 0,
            pixelOffsetBR: {
                x: 0,
                y: 0
            },
            pixelOffsetTL: {
                x: 0,
                y: 0
            }
        }]);

        expect(getIconQuads({
            top: -5.5,
            right: 30,
            bottom: 5.5,
            left: -30,
            imagePrimary
        }, 0, false)).toEqual([{
            tl: {x: -34, y: -6.5},
            tr: {x: 34, y: -6.5},
            bl: {x: -34, y: 6.5},
            br: {x: 34, y: 6.5},
            texPrimary: {x: 0, y: 0, w: 17, h: 13},
            texSecondary: undefined,
            writingMode: undefined,
            glyphOffset: [0, 0],
            isSDF: false,
            sectionIndex: 0,
            minFontScaleX: 0,
            minFontScaleY: 0,
            pixelOffsetBR: {
                x: 0,
                y: 0
            },
            pixelOffsetTL: {
                x: 0,
                y: 0
            }
        }]);
    });

    test('line', () => {
        expect(getIconQuads({
            top: -5.5,
            right: 7.5,
            bottom: 5.5,
            left: -7.5,
            imagePrimary
        }, 0, false)).toEqual([{
            tl: {x: -8.5, y: -6.5},
            tr: {x: 8.5, y: -6.5},
            bl: {x: -8.5, y: 6.5},
            br: {x: 8.5, y: 6.5},
            texPrimary: {x: 0, y: 0, w: 17, h: 13},
            texSecondary: undefined,
            writingMode: undefined,
            glyphOffset: [0, 0],
            isSDF: false,
            sectionIndex: 0,
            minFontScaleX: 0,
            minFontScaleY: 0,
            pixelOffsetBR: {
                x: 0,
                y: 0
            },
            pixelOffsetTL: {
                x: 0,
                y: 0
            }
        }]);
    });
});
