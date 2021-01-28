// @flow

import {number as interpolate} from '../style-spec/util/interpolate.js';
import Interpolate from '../style-spec/expression/definitions/interpolate.js';
import {clamp} from '../util/util.js';
import EvaluationParameters from '../style/evaluation_parameters.js';

import type {PropertyValue, PossiblyEvaluatedPropertyValue} from '../style/properties.js';
import type {InterpolationType} from '../style-spec/expression/definitions/interpolate.js';

const SIZE_PACK_FACTOR = 128;

export {getSizeData, evaluateSizeForFeature, evaluateSizeForZoom, SIZE_PACK_FACTOR};

export type SizeData = {
    kind: 'constant',
    layoutSize: number
} | {
    kind: 'source'
} | {
    kind: 'camera',
    minZoom: number,
    maxZoom: number,
    minSize: number,
    maxSize: number,
    interpolationType: ?InterpolationType
} | {
    kind: 'composite',
    minZoom: number,
    maxZoom: number,
    interpolationType: ?InterpolationType
};

// For {text,icon}-size, get the bucket-level data that will be needed by
// the painter to set symbol-size-related uniforms
function getSizeData(tileZoom: number, value: PropertyValue<number, PossiblyEvaluatedPropertyValue<number>>): SizeData {
    const {expression} = value;

    if (expression.kind === 'constant') {
        const layoutSize = expression.evaluate(new EvaluationParameters(tileZoom + 1));
        return {kind: 'constant', layoutSize};

    } else if (expression.kind === 'source') {
        return {kind: 'source'};

    } else {
        const {zoomStops, interpolationType} = expression;

        // calculate covering zoom stops for zoom-dependent values
        let lower = 0;
        while (lower < zoomStops.length && zoomStops[lower] <= tileZoom) lower++;
        lower = Math.max(0, lower - 1);
        let upper = lower;
        while (upper < zoomStops.length && zoomStops[upper] < tileZoom + 1) upper++;
        upper = Math.min(zoomStops.length - 1, upper);

        const minZoom = zoomStops[lower];
        const maxZoom = zoomStops[upper];

        // We'd like to be able to use CameraExpression or CompositeExpression in these
        // return types rather than ExpressionSpecification, but the former are not
        // transferrable across Web Worker boundaries.
        if (expression.kind === 'composite') {
            return {kind: 'composite', minZoom, maxZoom, interpolationType};
        }

        // for camera functions, also save off the function values
        // evaluated at the covering zoom levels
        const minSize = expression.evaluate(new EvaluationParameters(minZoom));
        const maxSize = expression.evaluate(new EvaluationParameters(maxZoom));

        return {kind: 'camera', minZoom, maxZoom, minSize, maxSize, interpolationType};
    }
}

function evaluateSizeForFeature(sizeData: SizeData,
                                {uSize, uSizeT}: { uSize: number, uSizeT: number },
                                {lowerSize, upperSize}: { lowerSize: number, upperSize: number}) {
    if (sizeData.kind === 'source') {
        return lowerSize / SIZE_PACK_FACTOR;
    } else if (sizeData.kind === 'composite') {
        return interpolate(lowerSize / SIZE_PACK_FACTOR, upperSize / SIZE_PACK_FACTOR, uSizeT);
    }
    return uSize;
}

function evaluateSizeForZoom(sizeData: SizeData, zoom: number) {
    let uSizeT = 0;
    let uSize = 0;

    if (sizeData.kind === 'constant') {
        uSize = sizeData.layoutSize;

    } else if (sizeData.kind !== 'source') {
        const {interpolationType, minZoom, maxZoom} = sizeData;

        // Even though we could get the exact value of the camera function
        // at z = tr.zoom, we intentionally do not: instead, we interpolate
        // between the camera function values at a pair of zoom stops covering
        // [tileZoom, tileZoom + 1] in order to be consistent with this
        // restriction on composite functions
        const t = !interpolationType ? 0 : clamp(
            Interpolate.interpolationFactor(interpolationType, zoom, minZoom, maxZoom), 0, 1);

        if (sizeData.kind === 'camera') {
            uSize = interpolate(sizeData.minSize, sizeData.maxSize, t);
        } else {
            uSizeT = t;
        }
    }

    return {uSizeT, uSize};
}
