'use strict';

var util = require('../../util/util');
var StyleLayer = require('../style_layer');

function LineStyleLayer() {
    StyleLayer.apply(this, arguments);
}

module.exports = LineStyleLayer;

LineStyleLayer.prototype = util.inherit(StyleLayer, {

    recalculate: function(zoom) {
        StyleLayer.prototype.recalculate.apply(this, arguments);

        // If the line is dashed, scale the dash lengths by the line
        // width at the previous round zoom level.
        if (this._transitions['line-dasharray']) {

            var lineWidth;
            if (this._transitions['line-width']) {
                lineWidth = this._transitions['line-width'].at(Math.floor(zoom), Infinity);
            } else {
                lineWidth = this.paint['line-width'];
            }

            var dashArray = this.paint['line-dasharray'];
            dashArray.fromScale *= lineWidth;
            dashArray.toScale *= lineWidth;
        }
    }

});
