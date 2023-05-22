// @flow

import {RGBAImage} from './image.js';
import {isPowerOfTwo} from './util.js';
import assert from 'assert';

import type {StylePropertyExpression} from '../style-spec/expression/index.js';

export type ColorRampParams = {
    expression: StylePropertyExpression;
    evaluationKey: string;
    resolution?: number;
    image?: RGBAImage;
    clips?: Array<Object>;
}

/**
 * Given an expression that should evaluate to a color ramp,
 * return a RGBA image representing that ramp expression.
 *
 * @private
 */
export function renderColorRamp(params: ColorRampParams): RGBAImage {
    const evaluationGlobals = {};
    const width = params.resolution || 256;
    const height = params.clips ? params.clips.length : 1;
    const image = params.image || new RGBAImage({width, height});

    assert(isPowerOfTwo(width));

    const renderPixel = (stride: number, index: number, progress: number) => {
        evaluationGlobals[params.evaluationKey] = progress;
        const pxColor = params.expression.evaluate((evaluationGlobals: any));
        // the colors are being unpremultiplied because Color uses
        // premultiplied values, and the Texture class expects unpremultiplied ones
        image.data[stride + index + 0] = Math.floor(pxColor.r * 255 / pxColor.a);
        image.data[stride + index + 1] = Math.floor(pxColor.g * 255 / pxColor.a);
        image.data[stride + index + 2] = Math.floor(pxColor.b * 255 / pxColor.a);
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
