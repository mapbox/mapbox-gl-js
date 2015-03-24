'use strict';

var reference = require('../reference/v7.json'),
    sortObject = require('sort-object');

function sameOrderAs(reference) {
    var keyOrder = {};

    Object.keys(reference).forEach(function(k, i) {
        keyOrder[k] = i + 1;
    });

    return {
        sort: function (a, b) {
            return (keyOrder[a] || Infinity) -
                   (keyOrder[b] || Infinity);
        }
    };
}

module.exports = function format(style) {
    style = sortObject(style, sameOrderAs(reference.$root));

    style.layers = style.layers.map(function(layer) {
        return sortObject(layer, sameOrderAs(reference.layer));
    });

    return JSON.stringify(style, null, 2);
};
