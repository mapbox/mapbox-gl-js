// @flow

const interpolate = require('../style-spec/util/interpolate');
const util = require('../util/util');

import type SymbolStyleLayer from '../style/style_layer/symbol_style_layer';

module.exports = {
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
        const t = layer.getLayoutInterpolationFactor(
            isText ? 'text-size' : 'icon-size',
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
        const t = layer.getLayoutInterpolationFactor(
            isText ? 'text-size' : 'icon-size',
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
