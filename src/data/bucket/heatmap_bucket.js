// @flow

const CircleBucket = require('./circle_bucket');
const {register} = require('../../util/web_worker_transfer');

import type HeatmapStyleLayer from '../../style/style_layer/heatmap_style_layer';

class HeatmapBucket extends CircleBucket<HeatmapStyleLayer> {
    // Needed for flow to accept omit: ['layers'] below, due to
    // https://github.com/facebook/flow/issues/4262
    layers: Array<HeatmapStyleLayer>;
}

register('HeatmapBucket', HeatmapBucket, {omit: ['layers']});

module.exports = HeatmapBucket;
