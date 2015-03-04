'use strict';

var util = require('../util/util');
var reference = require('./reference');
var StyleConstant = require('./style_constant');
var StyleDeclaration = require('./style_declaration');

var lookup = {
    paint: {},
    layout: {}
};

reference.layer.type.values.forEach(function(type) {
    lookup.paint[type] = makeConstructor(reference['paint_' + type]);
    lookup.layout[type] = makeConstructor(reference['layout_' + type]);
});

function makeConstructor(reference) {
    function StyleDeclarationSet(properties, constants) {
        this._values = {};
        this._transitions = {};

        this._constants = constants;

        for (var k in properties) {
            this[k] = StyleConstant.resolve(properties[k], this._constants);
        }
    }

    Object.keys(reference).forEach(function(k) {
        var property = reference[k];

        Object.defineProperty(StyleDeclarationSet.prototype, k, {
            set: function(v) {
                this._values[k] = new StyleDeclaration(property, StyleConstant.resolve(v, this._constants));
            },
            get: function() {
                return this._values[k].value;
            }
        });

        if (property.transition) {
            Object.defineProperty(StyleDeclarationSet.prototype, k + '-transition', {
                set: function(v) {
                    this._transitions[k] = v;
                },
                get: function() {
                    return this._transitions[k];
                }
            });
        }
    });

    StyleDeclarationSet.prototype.values = function() {
        return this._values;
    };

    StyleDeclarationSet.prototype.transition = function(k, global) {
        var t = this._transitions[k] || {};
        return {
            duration: util.coalesce(t.duration, global.duration, 300),
            delay: util.coalesce(t.delay, global.delay, 0)
        };
    };

    StyleDeclarationSet.prototype.json = function() {
        var result = {};

        for (var v in this._values) {
            result[v] = this._values[v].value;
        }

        for (var t in this._transitions) {
            result[t + '-transition'] = this._transitions[v];
        }

        return result;
    };

    return StyleDeclarationSet;
}

module.exports = function(renderType, layerType, properties, constants) {
    return new lookup[renderType][layerType](properties, constants);
};
