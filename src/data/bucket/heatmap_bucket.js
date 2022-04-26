// @flow

import CircleBucket from './circle_bucket.js';

import {register} from '../../util/web_worker_transfer.js';

import type HeatmapStyleLayer from '../../style/style_layer/heatmap_style_layer.js';

class HeatmapBucket extends CircleBucket<HeatmapStyleLayer> {
    // Needed for flow to accept omit: ['layers'] below, due to
    // https://github.com/facebook/flow/issues/4262
    layers: Array<HeatmapStyleLayer>;
}

register(HeatmapBucket, 'HeatmapBucket', {omit: ['layers']});

export default HeatmapBucket;
