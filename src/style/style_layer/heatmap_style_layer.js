// @flow

const StyleLayer = require('../style_layer');
const HeatmapBucket = require('../../data/bucket/heatmap_bucket');

class HeatmapStyleLayer extends StyleLayer {
    createBucket(options) {
        return new HeatmapBucket(options);
    }
}

module.exports = HeatmapStyleLayer;
