// @flow
import Color from '../style-spec/util/color.js';

import type {BlendEquationType, BlendFuncType, ColorMaskType} from './types.js';

export const ZERO = 0x0000;
export const ONE = 0x0001;
export const ONE_MINUS_SRC_ALPHA = 0x0303;
export const DST_COLOR = 0x0306;

export default class ColorMode {
    blendFunction: BlendFuncType;
    blendColor: Color;
    mask: ColorMaskType;
    blendEquation: ?BlendEquationType;

    constructor(blendFunction: BlendFuncType, blendColor: Color, mask: ColorMaskType, blendEquation: ?BlendEquationType) {
        this.blendFunction = blendFunction;
        this.blendColor = blendColor;
        this.mask = mask;
        this.blendEquation = blendEquation;
    }

    static Replace: BlendFuncType;

    static disabled: $ReadOnly<ColorMode>;
    static unblended: $ReadOnly<ColorMode>;
    static alphaBlended: $ReadOnly<ColorMode>;
    static multiply: $ReadOnly<ColorMode>;
}

ColorMode.Replace = [ONE, ZERO, ONE, ZERO];

ColorMode.disabled = new ColorMode(ColorMode.Replace, Color.transparent, [false, false, false, false]);
ColorMode.unblended = new ColorMode(ColorMode.Replace, Color.transparent, [true, true, true, true]);
ColorMode.alphaBlended = new ColorMode([ONE, ONE_MINUS_SRC_ALPHA, ONE, ONE_MINUS_SRC_ALPHA], Color.transparent, [true, true, true, true]);
ColorMode.multiply = new ColorMode([DST_COLOR, ZERO, DST_COLOR, ZERO], Color.transparent, [true, true, true, true]);
