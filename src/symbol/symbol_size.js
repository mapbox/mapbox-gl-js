// @flow

const interpolate = require('../style-spec/util/interpolate');
const {interpolationFactor} = require('../style-spec/function');
const util = require('../util/util');
const assert = require('assert');

import type StyleLayer from '../style/style_layer';

module.exports = {
    evaluateSizeForFeature,
    evaluateSizeForZoom
};

type SizeData = {
    isFeatureConstant: boolean,
    isZoomConstant: boolean,
    functionBase: number,
    coveringZoomRange: [number, number],
    coveringStopValues: [number, number],
    layoutSize: number
};

function evaluateSizeForFeature(sizeData: SizeData,
                                partiallyEvaluatedSize: { uSize: number, uSizeT: number },
                                symbol: { lowerSize: number, upperSize: number}) {
    const part = partiallyEvaluatedSize;
    if (sizeData.isFeatureConstant) {
        return part.uSize;
    } else {
        if (sizeData.isZoomConstant) {
            return symbol.lowerSize / 10;
        } else {
            return interpolate.number(symbol.lowerSize / 10, symbol.upperSize / 10, part.uSizeT);
        }
    }
}

function evaluateSizeForZoom(sizeData: SizeData,
                             tr: { zoom: number },
                             layer: StyleLayer,
                             isText: boolean) {
    const sizeUniforms = {};
    if (!sizeData.isZoomConstant && !sizeData.isFeatureConstant) {
        // composite function
        const t = interpolationFactor(tr.zoom,
            sizeData.functionBase,
            sizeData.coveringZoomRange[0],
            sizeData.coveringZoomRange[1]
        );
        sizeUniforms.uSizeT = util.clamp(t, 0, 1);
    } else if (sizeData.isFeatureConstant && !sizeData.isZoomConstant) {
        // camera function
        let size;
        if (sizeData.functionType === 'interval') {
            size = layer.getLayoutValue(isText ? 'text-size' : 'icon-size',
                {zoom: tr.zoom});
        } else {
            assert(sizeData.functionType === 'exponential');
            // Even though we could get the exact value of the camera function
            // at z = tr.zoom, we intentionally do not: instead, we interpolate
            // between the camera function values at a pair of zoom stops covering
            // [tileZoom, tileZoom + 1] in order to be consistent with this
            // restriction on composite functions
            const t = sizeData.functionType === 'interval' ? 0 :
                interpolationFactor(tr.zoom,
                    sizeData.functionBase,
                    sizeData.coveringZoomRange[0],
                    sizeData.coveringZoomRange[1]);

            const lowerValue = sizeData.coveringStopValues[0];
            const upperValue = sizeData.coveringStopValues[1];
            size = lowerValue + (upperValue - lowerValue) * util.clamp(t, 0, 1);
        }

        sizeUniforms.uSize = size;
    } else if (sizeData.isFeatureConstant && sizeData.isZoomConstant) {
        sizeUniforms.uSize = sizeData.layoutSize;
    }
    return sizeUniforms;
}
