// @flow
const Color = require('../style-spec/util/color');

import type {BlendFuncType, ColorMaskType} from './types';

const ONE = 1;
const ONE_MINUS_SRC_ALPHA = 0x0303;

class ColorMode {
    blend: boolean;
    blendFunction: BlendFuncType;
    blendColor: ?Color;
    mask: ColorMaskType;

    constructor(blend: boolean, blendFunction: BlendFuncType, blendColor: ?Color, mask: ColorMaskType) {
        this.blend = blend;
        this.blendFunction = blendFunction;
        this.blendColor = blendColor;
        this.mask = mask;
    }

    static Replace: BlendFuncType;

    static disabled(): ColorMode {
        return new ColorMode(false, ColorMode.Replace, null, [false, false, false, false]);
    }

    static unblended(): ColorMode {
        return new ColorMode(false, ColorMode.Replace, null, [true, true, true, true]);
    }

    static alphaBlended(): ColorMode {
        return new ColorMode(true, [ONE, ONE_MINUS_SRC_ALPHA], null, [true, true, true, true]);
    }
}

ColorMode.Replace = [ONE, ONE];

module.exports = ColorMode;
