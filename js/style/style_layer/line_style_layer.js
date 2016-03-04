'use strict';

var util = require('../../util/util');
var StyleLayer = require('../style_layer');

function LineStyleLayer() {
    StyleLayer.apply(this, arguments);
}

module.exports = LineStyleLayer;

LineStyleLayer.prototype = util.inherit(StyleLayer, {

    getPaintValue: function(name, zoom, zoomHistory) {
        var value = StyleLayer.prototype.getPaintValue.call(this, name, zoom, zoomHistory);

        // If the line is dashed, scale the dash lengths by the line
        // width at the previous round zoom level.
        if (value && name === 'line-dasharray') {
            var flooredZoom = Math.floor(zoom);
            if (this._flooredZoom !== flooredZoom) {
                this._flooredZoom = flooredZoom;
                this._flooredLineWidth = this.getPaintValue('line-width', flooredZoom, Infinity);
            }

            value.fromScale *= this._flooredLineWidth;
            value.toScale *= this._flooredLineWidth;
        }

        return value;
    }
});
