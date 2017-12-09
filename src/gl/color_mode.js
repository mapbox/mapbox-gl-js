// @flow
const Color = require('../style-spec/util/color');

import type {BlendFuncType, ColorMaskType} from './types';

const ZERO = 0x0000;
const ONE = 0x0001;
const ONE_MINUS_SRC_ALPHA = 0x0303;

class ColorMode {
    blendFunction: BlendFuncType;
    blendColor: Color;
    mask: ColorMaskType;

    constructor(blendFunction: BlendFuncType, blendColor: Color, mask: ColorMaskType) {
        this.blendFunction = blendFunction;
        this.blendColor = blendColor;
        this.mask = mask;
    }

    static Replace: BlendFuncType;

    static disabled(): ColorMode {
        return new ColorMode(ColorMode.Replace, Color.transparent, [false, false, false, false]);
    }

    static unblended(): ColorMode {
        return new ColorMode(ColorMode.Replace, Color.transparent, [true, true, true, true]);
    }

    static alphaBlended(): ColorMode {
        return new ColorMode([ONE, ONE_MINUS_SRC_ALPHA], Color.transparent, [true, true, true, true]);
    }
}

ColorMode.Replace = [ONE, ZERO];

module.exports = ColorMode;
