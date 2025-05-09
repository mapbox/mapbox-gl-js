import {RGBAImage} from './image';
import {isPowerOfTwo} from './util';
import assert from 'assert';

import type {StylePropertyExpression, GlobalProperties} from '../style-spec/expression/index';
import type {PremultipliedRenderColor} from '../style-spec/util/color';

export type ColorRampParams = {
    expression: StylePropertyExpression;
    evaluationKey: string;
    resolution?: number;
    image?: RGBAImage;
    clips?: Array<{start: number, end: number}>;
};

/**
 * Given an expression that should evaluate to a color ramp,
 * return a RGBA image representing that ramp expression.
 *
 * @private
 */
export function renderColorRamp(params: ColorRampParams): RGBAImage {
    const evaluationGlobals = {} as GlobalProperties;
    const width = params.resolution || 256;
    const height = params.clips ? params.clips.length : 1;
    const image = params.image || new RGBAImage({width, height});

    assert(isPowerOfTwo(width));

    const renderPixel = (stride: number, index: number, progress: number) => {
        evaluationGlobals[params.evaluationKey] = progress;
        const color = params.expression.evaluate(evaluationGlobals);
        const pxColor: PremultipliedRenderColor | null | undefined = color ? color.toNonPremultipliedRenderColor(null) : null;
        if (!pxColor) return;

        image.data[stride + index + 0] = Math.floor(pxColor.r * 255);
        image.data[stride + index + 1] = Math.floor(pxColor.g * 255);
        image.data[stride + index + 2] = Math.floor(pxColor.b * 255);
        image.data[stride + index + 3] = Math.floor(pxColor.a * 255);
    };

    if (!params.clips) {
        for (let i = 0, j = 0; i < width; i++, j += 4) {
            const progress = i / (width - 1);

            renderPixel(0, j, progress);
        }
    } else {
        for (let clip = 0, stride = 0; clip < height; ++clip, stride += width * 4) {
            for (let i = 0, j = 0; i < width; i++, j += 4) {
                // Remap progress between clips
                const progress = i / (width - 1);
                const {start, end} = params.clips[clip];
                const evaluationProgress = start * (1 - progress) + end * progress;
                renderPixel(stride, j, evaluationProgress);
            }
        }
    }

    return image;
}
