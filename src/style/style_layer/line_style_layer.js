'use strict';

const StyleLayer = require('../style_layer');
const LineBucket = require('../../data/bucket/line_bucket');
const util = require('../../util/util');

class LineStyleLayer extends StyleLayer {

    getPaintValue(name, globalProperties, featureProperties) {
        const value = super.getPaintValue(name, globalProperties, featureProperties);

        // If the line is dashed, scale the dash lengths by the line
        // width at the previous round zoom level.
        if (value && name === 'line-dasharray') {
            const width = this.getPaintValue('line-width',
                    util.extend({}, globalProperties, {zoom: Math.floor(globalProperties.zoom)}), featureProperties);
            value.fromScale *= width;
            value.toScale *= width;
        }

        return value;
    }

    createBucket(options) {
        return new LineBucket(options);
    }
}

module.exports = LineStyleLayer;
