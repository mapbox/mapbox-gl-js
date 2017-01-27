'use strict';

const refProperties = require('./util/ref_properties'),
    stringify = require('fast-stable-stringify');

function key(layer) {
    return stringify(refProperties.map((k) => {
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
 * @private
 * @param {Array<Layer>} layers
 * @returns {Array<Array<Layer>>}
 */
function groupByLayout(layers) {
    const groups = {};

    for (let i = 0; i < layers.length; i++) {
        const k = key(layers[i]);
        let group = groups[k];
        if (!group) {
            group = groups[k] = [];
        }
        group.push(layers[i]);
    }

    const result = [];

    for (const k in groups) {
        result.push(groups[k]);
    }

    return result;
}
