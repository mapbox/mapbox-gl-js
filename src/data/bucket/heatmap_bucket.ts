import CircleBucket from './circle_bucket';

import {register} from '../../util/web_worker_transfer';

import type HeatmapStyleLayer from '../../style/style_layer/heatmap_style_layer';

class HeatmapBucket extends CircleBucket<HeatmapStyleLayer> {
    layers: Array<HeatmapStyleLayer>;
}

register(HeatmapBucket, 'HeatmapBucket', {omit: ['layers']});

export default HeatmapBucket;
