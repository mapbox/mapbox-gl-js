'use strict';

var beautify = require('js-beautify').js_beautify,
    reference = require('../reference/v7.json'),
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

    var str = beautify(JSON.stringify(style), {
        indent_size: 2,
        keep_array_indentation: true
    }).replace(/"filter": {[^}]+}/g, function (str) {
        var str2 = str.replace(/([{}])\s+/g, '$1 ').replace(/,\s+/g, ', ').replace(/\s+}/g, ' }');
        return str2.length < 100 ? str2 : str;
    });

    return str;
};
