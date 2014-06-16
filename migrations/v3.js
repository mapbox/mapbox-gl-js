'use strict';

module.exports = function upgrade(v2) {
    return converter(v2);
};

function converter(v2) {
    var v3 = {
        version: 3
    };

    if (v2.sprite) {
        v3.sprite = v2.sprite;
    }

    if (v2.constants) {
        v3.constants = v2.constants;
    }

    if (v2.sources) {
        v3.sources = v2.sources;
    }

    var memo = {};

    v3.layers = v2.layers.map(function(layer) {
        return convertLayer(memo, layer, v2.buckets||{}, v2.styles||{});
    });

    return v3;
}

/*
Converter.prototype.convertStyles = function(styles) {
    this.types = {};

    for (var style_name in styles) {
        var style = styles[style_name];
        for (var name in style) {

            var old_rules = style[name];
            var rules = {};
            for (var old_rule_name in old_rules) {
                var new_rule_name = old_rule_name.replace(/(^|-)point-/, '$1icon-');

                if (new_rule_name == 'icon-size') {
                    rules[new_rule_name] = old_rules[old_rule_name];
                    rules[new_rule_name] = Math.max(rules[new_rule_name][0], rules[new_rule_name][1]);
                } else if (new_rule_name != 'icon-antialias') {
                    rules[new_rule_name] = old_rules[old_rule_name];
                }
            }

            style[name] = rules;

            for (var rule_name in rules) {
                var match = rule_name.match(/(?:^|-)(icon|line|fill|text)-/);
                if (match) {
                    this.types[name] = match[1];
                    break;
                }
            }

            if (rules['fill-color'] && rules['line-color']) {
                rules['fill-stroke-color'] = rules['line-color'];
                delete rules['line-color'];
            }
        }
    }

    return styles;
};
*/

function convertLayer(memo, v2, buckets, styles) {
    var k;
    var v3 = {};
    v3.id = v2.id;

    // This is a composite layer. Recurse.
    if (v2.layers) {
        return v3;
    // This layer's bucket has not been established yet. Do so.
    } else if (v2.bucket && !memo[v2.bucket]) {
        memo[v2.bucket] = v2.id;

        var bucket = buckets[v2.bucket];
        if (!bucket) throw new Error('bucket not found for layer ' + v2.id);

        // Migrate bucket.filter.
        if (bucket.filter) for (k in bucket.filter) {
            if (k === 'source') {
                v3.source = bucket.filter[k];
            } else if (k === 'layer') {
                v3['source-layer'] = bucket.filter[k];
            } else if (k === 'feature_type') {
                v3.filter = v3.filter || {};
                v3.filter.$type = bucket.filter[k];
            } else {
                v3.filter = v3.filter || {};
                v3.filter[k] = bucket.filter[k];
            }
        }
        // Migrate bucket raster properties.
        for (k in bucket) {
            if (k === 'filter') continue;
            v3.render = v3.render || {};
            if (/^(fill|line|point|text|raster|composite)$/.test(k)) {
                v3.render.type = k;
            } else {
                v3.render[k] = bucket[k];
            }
        }
    } else if (v2.bucket) {
        v3.ref = memo[v2.bucket];
    }

    for (var className in styles) {
        if (!styles[className][v2.id]) continue;
        var styleName = className === 'default' ? 'style' : 'style.' + className;
        for (k in styles[className][v2.id]) {
            v3[styleName] = v3[styleName] || {};
            v3[styleName][k] = styles[className][v2.id][k];
        }
    }
    /*
    if (layer.filter) {
        layer.source = layer.filter.source;
        layer.layer = layer.filter.layer;
        delete layer.filter.source;
        delete layer.filter.layer;

        if (layer.filter.feature_type) {
            layer.geometry = layer.filter.feature_type;
            delete layer.filter.feature_type;
        }

        if (Object.keys(layer.filter).length === 0) {
            delete layer.filter;
        }
    }
    */

    /*
    if (layer.layers) {
        layer.layers = this.convertLayers(layer.layers);
    } else {
        layer.type = this.types[layer.id];
    }
    */

    return v3;
}

