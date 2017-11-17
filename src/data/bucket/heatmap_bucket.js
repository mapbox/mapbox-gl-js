// @flow

const CircleBucket = require('./circle_bucket');

const heatmapInterface = {
    layoutAttributes: CircleBucket.programInterface.layoutAttributes,
    indexArrayType: CircleBucket.programInterface.indexArrayType,

    paintAttributes: [
        {property: 'heatmap-weight'}
    ]
};

class HeatmapBucket extends CircleBucket {}

HeatmapBucket.programInterface = heatmapInterface;

module.exports = HeatmapBucket;
