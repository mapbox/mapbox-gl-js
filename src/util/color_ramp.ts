import {RGBAImage} from './image';
import {isPowerOfTwo} from './util';
import {lerp} from '../style-spec/util/lerp';
import assert from '../style-spec/util/assert';

import type {StylePropertyExpression, GlobalProperties} from '../style-spec/expression/index';
import type {default as Color} from '../style-spec/util/color';
import type {LUT} from './lut';

export type ColorRampScale = 'linear' | 'log';

export type ColorRampParams = {
    expression: StylePropertyExpression;
    evaluationKey: string;
    resolution?: number;
    scale?: ColorRampScale;
    image?: RGBAImage;
    clips?: Array<{start: number, end: number}>;
    lut?: LUT | null;
};

/**
 * Map a normalized ramp position to an input value in the color range, spaced linearly or (for `log`) exponentially.
 * @param value Normalized ramp position [0, 1].
 * @param start Start of the color range to map into.
 * @param end End of the color range to map into.
 * @param scale `linear` for even spacing, `log` to give small values more of the ramp.
 * @returns Input value passed to the color expression.
 */
const mapValueToRange = (value: number, start: number, end: number, scale: ColorRampScale): number => {
    // Spread texels exponentially across the range.
    // The raster shader MUST undo this with the exact inverse, or every color is wrong.
    const scaledValue = scale === 'log' ? (Math.pow(10, value) - 1) / (10 - 1) : value;
    return lerp(start, end, scaledValue);
};

/**
 * Bake a color expression into an RGBA lookup-table image (a "color ramp"), one row per clip.
 * @param params Ramp options.
 * @param params.expression Color-ramp expression to evaluate.
 * @param params.evaluationKey Global the expression reads its input from (e.g. `rasterValue`).
 * @param params.resolution Ramp width in texels; defaults to 256 and must be a power of two.
 * @param params.scale `linear` (default) for even spacing, `log` to give small values more of the ramp.
 * @param params.clips Value ranges to bake, one ramp row each; defaults to a single [0, 1] row.
 * @param params.image Existing image to reuse; a new one is allocated if omitted.
 * @param params.lut Optional color-space lookup table.
 * @returns The baked RGBA ramp image.
 * @private
 */
export function renderColorRamp(params: ColorRampParams): RGBAImage {
    const {
        expression,
        evaluationKey,
        resolution: width = 256,
        clips,
        scale = 'linear',
        lut = null,
    } = params;

    assert(isPowerOfTwo(width));

    const height = clips ? clips.length : 1;
    const image = params.image || new RGBAImage({width, height});
    const evaluationGlobals = {} as GlobalProperties; // color ramps have no camera, so `zoom` (required by GlobalProperties) is left unset.

    // Evaluate the expression at one value and write its RGBA to the texel at row `stride` + column `index`.
    const renderTexel = (stride: number, index: number, evaluationValue: number) => {
        evaluationGlobals[evaluationKey] = evaluationValue;
        const color: Color = expression.evaluate(evaluationGlobals);
        const texelColor = color?.toNonPremultipliedRenderColor(lut) ?? null;
        if (!texelColor) return;

        image.data[stride + index + 0] = Math.floor(texelColor.r * 255);
        image.data[stride + index + 1] = Math.floor(texelColor.g * 255);
        image.data[stride + index + 2] = Math.floor(texelColor.b * 255);
        image.data[stride + index + 3] = Math.floor(texelColor.a * 255);
    };

    for (let clip = 0, stride = 0; clip < height; ++clip, stride += width * 4) {
        const start = clips?.[clip].start ?? 0;
        const end = clips?.[clip].end ?? 1;
        for (let i = 0, j = 0; i < width; i++, j += 4) {
            const evaluationValue = mapValueToRange(i / (width - 1), start, end, scale);
            renderTexel(stride, j, evaluationValue);
        }
    }

    return image;
}
