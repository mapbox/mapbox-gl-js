'use strict';


function Converter(v1) {
    this.v1 = v1;

    var v2 = this.v2 = {
        version: 2,
        layers: [],
        styles: {}
    };

    if (v1.sprite) {
        v2.sprite = v1.sprite;
    }
    if (v1.constants) {
        v2.constants = v1.constants;
    }

    v2.styles = this.convertStyles(v1.styles);
    v2.layers = this.convertLayers(v1.layers);
}

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

Converter.prototype.convertLayer = function(layer) {
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

    if (layer.layers) {
        layer.layers = this.convertLayers(layer.layers);
    } else {
        layer.type = this.types[layer.id];
    }

    return layer;
};

Converter.prototype.convertLayers = function(layers) {
    return layers.map(this.convertLayer, this);
};


module.exports = function upgrade(v1) {
    var converter = new Converter(v1);
    return converter.v2;
};
