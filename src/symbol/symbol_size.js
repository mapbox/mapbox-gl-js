// @flow

import { number as interpolate } from '../style-spec/util/interpolate';
import Interpolate from '../style-spec/expression/definitions/interpolate';
import { clamp } from '../util/util';
import EvaluationParameters from '../style/evaluation_parameters';

import type {PropertyValue, PossiblyEvaluatedPropertyValue} from '../style/properties';
import type {InterpolationType} from '../style-spec/expression/definitions/interpolate';

const SIZE_PACK_FACTOR = 256;

export { getSizeData, evaluateSizeForFeature, evaluateSizeForZoom, SIZE_PACK_FACTOR };

export type SizeData = {
    functionType: 'constant',
    layoutSize: number
} | {
    functionType: 'source'
} | {
    functionType: 'camera',
    layoutSize: number,
    zoomRange: {min: number, max: number},
    sizeRange: {min: number, max: number},
    interpolationType: ?InterpolationType
} | {
    functionType: 'composite',
    zoomRange: {min: number, max: number},
    interpolationType: ?InterpolationType
};

// For {text,icon}-size, get the bucket-level data that will be needed by
// the painter to set symbol-size-related uniforms
function getSizeData(tileZoom: number, value: PropertyValue<number, PossiblyEvaluatedPropertyValue<number>>): SizeData {
    const {expression} = value;
    if (expression.kind === 'constant') {
        return {
            functionType: 'constant',
            layoutSize: expression.evaluate(new EvaluationParameters(tileZoom + 1))
        };
    } else if (expression.kind === 'source') {
        return {
            functionType: 'source'
        };
    } else {
        // calculate covering zoom stops for zoom-dependent values
        const levels = expression.zoomStops;

        let lower = 0;
        while (lower < levels.length && levels[lower] <= tileZoom) lower++;
        lower = Math.max(0, lower - 1);
        let upper = lower;
        while (upper < levels.length && levels[upper] < tileZoom + 1) upper++;
        upper = Math.min(levels.length - 1, upper);

        const zoomRange = {
            min: levels[lower],
            max: levels[upper]
        };

        const {interpolationType} = expression;

        // We'd like to be able to use CameraExpression or CompositeExpression in these
        // return types rather than ExpressionSpecification, but the former are not
        // transferrable across Web Worker boundaries.
        if (expression.kind === 'composite') {
            return {
                functionType: 'composite',
                zoomRange,
                interpolationType
            };
        } else {
            // for camera functions, also save off the function values
            // evaluated at the covering zoom levels
            return {
                functionType: 'camera',
                layoutSize: expression.evaluate(new EvaluationParameters(tileZoom + 1)),
                zoomRange,
                sizeRange: {
                    min: expression.evaluate(new EvaluationParameters(zoomRange.min)),
                    max: expression.evaluate(new EvaluationParameters(zoomRange.max))
                },
                interpolationType
            };
        }
    }
}

function evaluateSizeForFeature(sizeData: SizeData,
                                partiallyEvaluatedSize: { uSize: number, uSizeT: number },
                                symbol: { lowerSize: number, upperSize: number}) {
    const part = partiallyEvaluatedSize;
    if (sizeData.functionType === 'source') {
        return symbol.lowerSize / SIZE_PACK_FACTOR;
    } else if (sizeData.functionType === 'composite') {
        return interpolate(symbol.lowerSize / SIZE_PACK_FACTOR, symbol.upperSize / SIZE_PACK_FACTOR, part.uSizeT);
    } else {
        return part.uSize;
    }
}

function evaluateSizeForZoom(sizeData: SizeData, zoom: number) {
    if (sizeData.functionType === 'constant') {
        return {
            uSizeT: 0,
            uSize: sizeData.layoutSize
        };
    } else if (sizeData.functionType === 'source') {
        return {
            uSizeT: 0,
            uSize: 0
        };
    } else {

        const {interpolationType, zoomRange} = sizeData;

        // Even though we could get the exact value of the camera function
        // at z = tr.zoom, we intentionally do not: instead, we interpolate
        // between the camera function values at a pair of zoom stops covering
        // [tileZoom, tileZoom + 1] in order to be consistent with this
        // restriction on composite functions
        const t = !interpolationType ? 0 : clamp(
            Interpolate.interpolationFactor(interpolationType, zoom, zoomRange.min, zoomRange.max), 0, 1);

        if (sizeData.functionType === 'camera') {
            const {sizeRange} = sizeData;
            return {
                uSizeT: 0,
                uSize: sizeRange.min + t * (sizeRange.max - sizeRange.min)
            };
        }

        return {
            uSizeT: t,
            uSize: 0
        };
    }
}
