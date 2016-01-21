'use strict';

var util = require('../../util/util');
var StyleLayer = require('../style_layer');

function LineStyleLayer() {
    StyleLayer.apply(this, arguments);
}

module.exports = LineStyleLayer;

LineStyleLayer.prototype = util.inherit(StyleLayer, {

    getPaintValue: function(name, zoom) {
        var output = StyleLayer.prototype.getPaintValue.apply(this, arguments);

        // If the line is dashed, scale the dash lengths by the line
        // width at the previous round zoom level.
        if (name === 'line-dasharray') {
            var lineWidth = this.getPaintValue('line-width', Math.floor(zoom), Infinity);
            output.fromScale *= lineWidth;
            output.toScale *= lineWidth;
        }

        return output;
    }

});
