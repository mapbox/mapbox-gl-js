'use strict';

var VectorTileFeature = require('../format/vectortilefeature.js');

exports.stats = function() {
    var tile = this.data;
    var omit = ['osm_id', 'name', 'name_en', 'name_de', 'name_es', 'name_fr', 'maki', 'website', 'address', 'reflen', 'len', 'area'];

    var stats = { fill: {}, line: {}, point: {} };
    for (var layer_name in tile.layers) {
        var layer = tile.layers[layer_name];
        var tags = {};
        for (var i = 0; i < layer.length; i++) {
            var feature = layer.feature(i);
            var type = VectorTileFeature.mapping[feature._type];
            if (!(type in tags)) tags[type] = stats[type][layer_name] = { '(all)': 0 };
            tags[type]['(all)']++;
            for (var key in feature) {
                if (feature.hasOwnProperty(key) && key[0] !== '_' && omit.indexOf(key) < 0) {
                    if (!(key in tags[type])) tags[type][key] = {};
                    var val = feature[key];
                    if (tags[type][key][val]) tags[type][key][val]++;
                    else tags[type][key][val] = 1;
                }
            }
        }
    }

    return stats;
};

