// @flow

const CircleBucket = require('./circle_bucket');
const {register} = require('../../util/web_worker_transfer');

import type HeatmapStyleLayer from '../../style/style_layer/heatmap_style_layer';

const heatmapInterface = {
    layoutAttributes: CircleBucket.programInterface.layoutAttributes,
    indexArrayType: CircleBucket.programInterface.indexArrayType,

    paintAttributes: [
        {property: 'heatmap-weight'}
    ]
};

class HeatmapBucket extends CircleBucket<HeatmapStyleLayer> {
    // Needed for flow to accept omit: ['layers'] below, due to
    // https://github.com/facebook/flow/issues/4262
    layers: Array<HeatmapStyleLayer>;
}

register('HeatmapBucket', HeatmapBucket, {omit: ['layers']});

HeatmapBucket.programInterface = heatmapInterface;

module.exports = HeatmapBucket;
