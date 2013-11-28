'use strict';

var evented = require('../lib/evented.js');
var chroma = require('../lib/chroma.js');

var util = require('../util/util.js');
var StyleDeclaration = require('./styledeclaration.js');
var ImageSprite = require('./imagesprite.js');

module.exports = Stylesheet;

evented(Stylesheet);

/*
 * A parsed repesentation of a stylesheet
 */
function Stylesheet(data) {

    if (!data) data = {};

    this.sprite = null;

    this.constants = data.constants || {};
    this.buckets = data.buckets || {};
    this.structure = data.structure || [];
    this.classes = [];

    var classes = data.classes;
    for (var i = 0; i < classes.length; i++) {
        this.classes.push(parseClass(classes[i], this.constants));
    }

    if (data.sprite) this.setSprite(data.sprite);
}

function parseClass(sheetClass, constants) {
    var parsed = {
        name: sheetClass.name,
        layers: {}
    };

    for (var name in sheetClass.layers) {
        var layer = sheetClass.layers[name];

        parsed.layers[name] = {};

        for (var prop in layer) {
            parsed.layers[name][prop] = prop.indexOf('transition-') === 0 ? layer[prop] : new StyleDeclaration(prop, layer[prop], constants);
        }

    }

    return parsed;
}

Stylesheet.prototype.setSprite = function(sprite) {
    var style = this;
    this.sprite = new ImageSprite(sprite);
    this.sprite.on('loaded', function() {
        style.fire('change');
        style.fire('change:sprite');
    });
};
