import {number as interpolate} from '../style-spec/util/interpolate';
import Interpolate from '../style-spec/expression/definitions/interpolate';
import {clamp} from '../util/util';
import EvaluationParameters from '../style/evaluation_parameters';

import type {PropertyValue, PossiblyEvaluatedPropertyValue} from '../style/properties';
import type {InterpolationType} from '../style-spec/expression/definitions/interpolate';
import type {CanonicalTileID} from '../source/tile_id';
import type {SymbolFeature} from '../data/bucket/symbol_bucket';
import type {ImageId} from '../style-spec/expression/types/image_id';

export const SIZE_PACK_FACTOR = 128;

export type SizeData = {
    kind: 'constant';
    layoutSize: number;
} | {
    kind: 'source';
} | {
    kind: 'camera';
    minZoom: number;
    maxZoom: number;
    minSize: number;
    maxSize: number;
    interpolationType: InterpolationType | null | undefined;
} | {
    kind: 'composite';
    minZoom: number;
    maxZoom: number;
    interpolationType: InterpolationType | null | undefined;
};

export type InterpolatedSize = {
    uSize: number;
    uSizeT: number;
};

// We need to rasterize vector icon with maximum possible size to avoid
// scaling artifacts. This function calculates the maximum size of the
// icon that will be rasterized for a given zoom level and with the given
// icon-size value.
// - For composite functions, we need to rasterize the icon at the given maximum size
// - For camera functions, we need to rasterize the icon at the maximum size of closest zoom stops
// - For constant functions, we need to rasterize the icon at the given size
export function getRasterizedIconSize(
    sizeData: SizeData,
    unevaluatedIconSize: PropertyValue<number, PossiblyEvaluatedPropertyValue<number>>,
    canonical: CanonicalTileID,
    zoom: number,
    feature: SymbolFeature,
    worldview: string | undefined,
    availableImages?: ImageId[]
) {
    if (sizeData.kind === 'camera') {
        return sizeData.maxSize;
    }

    if (sizeData.kind === 'composite') {
        const maxZoomSize = unevaluatedIconSize
            .possiblyEvaluate(new EvaluationParameters(sizeData.maxZoom, {worldview}), canonical, availableImages)
            .evaluate(feature, {}, canonical, availableImages);
        const minZoomSize = unevaluatedIconSize
            .possiblyEvaluate(new EvaluationParameters(sizeData.minZoom, {worldview}), canonical, availableImages)
            .evaluate(feature, {}, canonical, availableImages);

        return Math.max(maxZoomSize, minZoomSize);
    }

    return unevaluatedIconSize.possiblyEvaluate(new EvaluationParameters(zoom, {worldview}), canonical, availableImages).evaluate(feature, {}, canonical, availableImages);
}

// For {text,icon}-size, get the bucket-level data that will be needed by
// the painter to set symbol-size-related uniforms
export function getSizeData(
    tileZoom: number,
    value: PropertyValue<number, PossiblyEvaluatedPropertyValue<number>>,
    worldview: string | undefined,
    availableImages?: ImageId[]
): SizeData {
    const {expression} = value;

    if (expression.kind === 'constant') {
        const layoutSize: number = expression.evaluate(new EvaluationParameters(tileZoom + 1, {worldview}), undefined, undefined, undefined, availableImages);
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
        const minSize: number = expression.evaluate(new EvaluationParameters(minZoom, {worldview}), undefined, undefined, undefined, availableImages);
        const maxSize: number = expression.evaluate(new EvaluationParameters(maxZoom, {worldview}), undefined, undefined, undefined, availableImages);

        return {kind: 'camera', minZoom, maxZoom, minSize, maxSize, interpolationType};
    }
}

export function evaluateSizeForFeature(
    sizeData: SizeData,
    {
        uSize,
        uSizeT,
    }: InterpolatedSize,
    {
        lowerSize,
        upperSize,
    }: {
        readonly lowerSize: number;
        readonly upperSize: number;
    },
): number {
    if (sizeData.kind === 'source') {
        return lowerSize / SIZE_PACK_FACTOR;
    } else if (sizeData.kind === 'composite') {
        return interpolate(lowerSize / SIZE_PACK_FACTOR, upperSize / SIZE_PACK_FACTOR, uSizeT);
    }
    return uSize;
}

export function evaluateSizeForZoom(sizeData: SizeData, zoom: number, scaleFactor: number = 1): InterpolatedSize {
    let uSizeT = 0;
    let uSize = 0;

    if (sizeData.kind === 'constant') {
        uSize = sizeData.layoutSize * scaleFactor;

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
            uSize = interpolate(sizeData.minSize, sizeData.maxSize, t) * scaleFactor;
        } else {
            uSizeT = t * scaleFactor;
        }
    }

    return {uSizeT, uSize};
}
