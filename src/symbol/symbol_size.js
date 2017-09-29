// @flow

const interpolate = require('../style-spec/util/interpolate');
const util = require('../util/util');

import type SymbolStyleLayer from '../style/style_layer/symbol_style_layer';
import type StyleDeclaration from '../style/style_declaration';

module.exports = {
    getSizeData,
    evaluateSizeForFeature,
    evaluateSizeForZoom
};

export type SizeData = {
    functionType: 'constant',
    layoutSize: number
} | {
    functionType: 'camera',
    layoutSize: number,
    coveringZoomRange: [number, number],
    coveringStopValues: [number, number]
} | {
    functionType: 'source'
} | {
    functionType: 'composite',
    coveringZoomRange: [number, number]
};

// For {text,icon}-size, get the bucket-level data that will be needed by
// the painter to set symbol-size-related uniforms
function getSizeData(tileZoom: number, layer: SymbolStyleLayer, sizeProperty: string): SizeData {
    const declaration: StyleDeclaration = layer.getLayoutDeclaration(sizeProperty);
    const isFeatureConstant = !declaration || declaration.expression.isFeatureConstant;

    if (!declaration || declaration.expression.isZoomConstant) {
        return isFeatureConstant ? {
            functionType: 'constant',
            layoutSize: layer.getLayoutValue(sizeProperty, {zoom: tileZoom + 1})
        } : { functionType: 'source' };
    }

    // calculate covering zoom stops for zoom-dependent values
    const levels = declaration.expression.zoomStops;

    let lower = 0;
    while (lower < levels.length && levels[lower] <= tileZoom) lower++;
    lower = Math.max(0, lower - 1);
    let upper = lower;
    while (upper < levels.length && levels[upper] < tileZoom + 1) upper++;
    upper = Math.min(levels.length - 1, upper);

    const coveringZoomRange: [number, number] = [levels[lower], levels[upper]];

    if (!isFeatureConstant) {
        return {
            functionType: 'composite',
            coveringZoomRange
        };
    } else {
        // for camera functions, also save off the function values
        // evaluated at the covering zoom levels
        return {
            functionType: 'camera',
            layoutSize: layer.getLayoutValue(sizeProperty, {zoom: tileZoom + 1}),
            coveringZoomRange,
            coveringStopValues: [
                layer.getLayoutValue(sizeProperty, {zoom: levels[lower]}),
                layer.getLayoutValue(sizeProperty, {zoom: levels[upper]})
            ]
        };
    }
}

function evaluateSizeForFeature(sizeData: SizeData,
                                partiallyEvaluatedSize: { uSize: number, uSizeT: number },
                                symbol: { lowerSize: number, upperSize: number}) {
    const part = partiallyEvaluatedSize;
    if (sizeData.functionType === 'source') {
        return symbol.lowerSize / 10;
    } else if (sizeData.functionType === 'composite') {
        return interpolate.number(symbol.lowerSize / 10, symbol.upperSize / 10, part.uSizeT);
    } else {
        return part.uSize;
    }
}

function evaluateSizeForZoom(sizeData: SizeData,
                             tr: { zoom: number },
                             layer: SymbolStyleLayer,
                             isText: boolean) {
    const sizeUniforms = {};
    if (sizeData.functionType === 'composite') {
        const declaration = layer.getLayoutDeclaration(
            isText ? 'text-size' : 'icon-size');
        const t = declaration.interpolationFactor(
            tr.zoom,
            sizeData.coveringZoomRange[0],
            sizeData.coveringZoomRange[1]);
        sizeUniforms.uSizeT = util.clamp(t, 0, 1);
    } else if (sizeData.functionType === 'camera') {
        // Even though we could get the exact value of the camera function
        // at z = tr.zoom, we intentionally do not: instead, we interpolate
        // between the camera function values at a pair of zoom stops covering
        // [tileZoom, tileZoom + 1] in order to be consistent with this
        // restriction on composite functions
        const declaration = layer.getLayoutDeclaration(
            isText ? 'text-size' : 'icon-size');
        const t = declaration.interpolationFactor(
            tr.zoom,
            sizeData.coveringZoomRange[0],
            sizeData.coveringZoomRange[1]);

        const lowerValue = sizeData.coveringStopValues[0];
        const upperValue = sizeData.coveringStopValues[1];
        sizeUniforms.uSize = lowerValue + (upperValue - lowerValue) * util.clamp(t, 0, 1);
    } else if (sizeData.functionType === 'constant') {
        sizeUniforms.uSize = sizeData.layoutSize;
    }
    return sizeUniforms;
}
