'use strict';

var extend = require('./util/extend');

/**
 * Returns a new style with the given 'paint classes' merged into each layer's
 * main `paint` definiton.
 *
 * @param {Object} style A style JSON object.
 * @param {Array<string>} classes An array of paint classes to apply, in order.
 */
module.exports = function declassStyle(style, classes) {
    return extend({}, style, {
        layers: style.layers.map(function (layer) {
            var result = classes.reduce(declassLayer, layer);

            // strip away all `paint.CLASS` definitions
            for (var key in result) {
                if (/paint\..*/.test(key)) {
                    delete result[key];
                }
            }

            return result;
        })
    });
};

function declassLayer(layer, klass) {
    return extend({}, layer, {
        paint: extend({}, layer.paint, layer['paint.' + klass])
    });
}
