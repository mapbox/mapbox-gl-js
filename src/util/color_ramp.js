// @flow

import {RGBAImage} from './image';
import {isPowerOfTwo} from './util';
import assert from 'assert';

import type {StylePropertyExpression} from '../style-spec/expression/index';

/**
 * Given an expression that should evaluate to a color ramp, return
 * a 256x1 px RGBA image representing that ramp expression.
 *
 * @private
 */
export default function renderColorRamp(expression: StylePropertyExpression, colorRampEvaluationParameter: string, textureResolution?: number): RGBAImage {
    const resolution = textureResolution || 256;
    assert(isPowerOfTwo(resolution));
    const colorRampData = new Uint8Array(resolution * 4);
    const evaluationGlobals = {};
    for (let i = 0, j = 0; i < resolution; i++, j += 4) {
        evaluationGlobals[colorRampEvaluationParameter] = i / (resolution - 1);
        const pxColor = expression.evaluate((evaluationGlobals: any));
        // the colors are being unpremultiplied because Color uses
        // premultiplied values, and the Texture class expects unpremultiplied ones
        colorRampData[j + 0] = Math.floor(pxColor.r * 255 / pxColor.a);
        colorRampData[j + 1] = Math.floor(pxColor.g * 255 / pxColor.a);
        colorRampData[j + 2] = Math.floor(pxColor.b * 255 / pxColor.a);
        colorRampData[j + 3] = Math.floor(pxColor.a * 255);
    }
    return new RGBAImage({width: resolution, height: 1}, colorRampData);
}
