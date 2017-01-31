'use strict';

var refProperties = require('./util/ref_properties');
var stringify = require('fast-stable-stringify');

function key(layer) {
    return stringify(refProperties.map(function (k) {
        return layer[k];
    }));
}

module.exports = groupByLayout;

/**
 * Given an array of layers, return an array of arrays of layers where all
 * layers in each group have identical layout-affecting properties. These
 * are the properties that were formerly used by explicit `ref` mechanism
 * for layers: 'type', 'source', 'source-layer', 'minzoom', 'maxzoom',
 * 'filter', and 'layout'.
 *
 * The input is not modified. The output layers are references to the
 * input layers.
 *
 * @param {Array<Layer>} layers
 * @returns {Array<Array<Layer>>}
 */
function groupByLayout(layers) {
    var groups = {}, i, k;

    for (i = 0; i < layers.length; i++) {
        k = key(layers[i]);
        var group = groups[k];
        if (!group) {
            group = groups[k] = [];
        }
        group.push(layers[i]);
    }

    var result = [];

    for (k in groups) {
        result.push(groups[k]);
    }

    return result;
}
