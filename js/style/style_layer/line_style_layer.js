'use strict';

var util = require('../../util/util');
var StyleLayer = require('../style_layer');

function LineStyleLayer() {
    StyleLayer.apply(this, arguments);
}

module.exports = LineStyleLayer;

LineStyleLayer.prototype = util.inherit(StyleLayer, {

    getPaintValue: function(name, zoom, zoomHistory) {
        var output = StyleLayer.prototype.getPaintValue.call(this, name, zoom, zoomHistory);

        // If the line is dashed, scale the dash lengths by the line
        // width at the previous round zoom level.
        if (output && name === 'line-dasharray') {
            var lineWidth = this.getPaintValue('line-width', Math.floor(zoom), Infinity);
            output.fromScale *= lineWidth;
            output.toScale *= lineWidth;
        }

        return output;
    },

    recalculate: function(zoom, zoomHistory) {
        StyleLayer.prototype.recalculate.call(this, zoom, zoomHistory);
        var key = 'line-dasharray';
        if (this._paintTransitions[key]) this.paint[key] = this.getPaintValue(key, zoom, zoomHistory);
    }
});
