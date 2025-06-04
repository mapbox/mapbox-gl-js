import Color, {type NonPremultipliedRenderColor} from '../style-spec/util/color';

import type {BlendEquationType, BlendFuncType, ColorMaskType} from './types';

export const ZERO = 0x0000;
export const ONE = 0x0001;
export const SRC_ALPHA = 0x0302;
export const ONE_MINUS_SRC_ALPHA = 0x0303;
export const DST_COLOR = 0x0306;

export default class ColorMode {
    blendFunction: BlendFuncType;
    blendColor: NonPremultipliedRenderColor;
    mask: ColorMaskType;
    blendEquation: BlendEquationType | null | undefined;

    constructor(blendFunction: BlendFuncType, blendColor: Color, mask: ColorMaskType, blendEquation?: BlendEquationType | null) {
        this.blendFunction = blendFunction;
        this.blendColor = blendColor.toNonPremultipliedRenderColor(null);
        this.mask = mask;
        this.blendEquation = blendEquation;
    }

    static Replace: BlendFuncType;

    static disabled: Readonly<ColorMode>;
    static unblended: Readonly<ColorMode>;
    static alphaBlended: Readonly<ColorMode>;
    static alphaBlendedNonPremultiplied: Readonly<ColorMode>;
    static multiply: Readonly<ColorMode>;
}

ColorMode.Replace = [ONE, ZERO, ONE, ZERO];

ColorMode.disabled = new ColorMode(ColorMode.Replace, Color.transparent, [false, false, false, false]);
ColorMode.unblended = new ColorMode(ColorMode.Replace, Color.transparent, [true, true, true, true]);
ColorMode.alphaBlended = new ColorMode([ONE, ONE_MINUS_SRC_ALPHA, ONE, ONE_MINUS_SRC_ALPHA], Color.transparent, [true, true, true, true]);
ColorMode.alphaBlendedNonPremultiplied = new ColorMode([SRC_ALPHA, ONE_MINUS_SRC_ALPHA, SRC_ALPHA, ONE_MINUS_SRC_ALPHA], Color.transparent, [true, true, true, true]);
ColorMode.multiply = new ColorMode([DST_COLOR, ZERO, DST_COLOR, ZERO], Color.transparent, [true, true, true, true]);
