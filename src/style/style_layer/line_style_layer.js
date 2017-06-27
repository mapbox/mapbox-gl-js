
const StyleLayer = require('../style_layer');
const LineBucket = require('../../data/bucket/line_bucket');

class LineStyleLayer extends StyleLayer {
    createBucket(options) {
        return new LineBucket(options);
    }
}

module.exports = LineStyleLayer;
