'use strict';

var evented = require('../lib/evented.js');
var chroma = require('../lib/chroma.js');

var util = require('../util/util.js');

var StyleTransition = require('./styletransition.js');
var ImageSprite = require('./imagesprite.js');


module.exports = Style;

evented(Style);

/*
 * The map style's current state
 */
function Style(stylesheet, animationLoop) {
    this.classes = { main: true };
    this.stylesheet = stylesheet;
    this.animationLoop = animationLoop;

    this.layers = {};

    this.recalculate();
}

// Formerly known as zoomed styles
Style.prototype.getApplied = function(z) {

    var layers = this.layers;
    var layerValues = {};

    for (var name in layers) {
        var layer = layers[name];

        var appliedLayer = layerValues[name] = {};

        for (var rule in layer) {
            var transition = layer[rule];
            appliedLayer[rule] = transition.at(z);
        }

        // Some properties influence others
        if (appliedLayer.opacity && appliedLayer.color) {
            appliedLayer.color.alpha(appliedLayer.opacity);
            appliedLayer.color = appliedLayer.color.premultiply();
        }

        if (appliedLayer.opacity && appliedLayer.stroke) {
            appliedLayer.stroke.alpha(appliedLayer.opacity);
            appliedLayer.stroke = appliedLayer.stroke.premultiply();
        }

        // todo add more checks for width and color
        if (appliedLayer.opacity === 0) {
            appliedLayer.hidden = true;
        }
    }

    return layerValues;
};
        
Style.prototype.recalculate = function() {

    var newStyle = {};
    var name, prop, layer, declaration;

    var sheetClasses = this.stylesheet.classes;
    var transitions = {};

    // Recalculate style
    // Basic cascading
    for (var i = 0; i < sheetClasses.length; i++) {
        var sheetClass = sheetClasses[i];

        // Not enabled
        if (!this.classes[sheetClass.name]) continue;

        for (name in sheetClass.layers) {
            layer = sheetClass.layers[name];

            if (typeof newStyle[name] === 'undefined') newStyle[name] = {};
            if (typeof transitions[name] === 'undefined') transitions[name] = {};

            for (prop in layer) {

                if (prop.indexOf('transition-') === 0) {
                    var tprop = prop;
                    transitions[name][prop.replace('transition-', '')] = layer[tprop];

                } else {
                    declaration = layer[prop];
                    newStyle[name][prop] = declaration;
                }
            }
        }
    }

    var layers = this.layers;

    // Calculate new transitions
    for (name in newStyle) {
        layer = newStyle[name];

        if (typeof layers[name] === 'undefined') layers[name] = {};

        for (prop in layer) {
            declaration = layer[prop];

            var oldTransition = layers[name][prop];
            var transition = transitions[name][prop];

            if (!oldTransition || oldTransition.declaration !== declaration) {
                var newTransition = new StyleTransition(declaration, oldTransition, transition);
                layers[name][prop] = newTransition;

                // Run the animation loop until the end of the transition
                newTransition.loopID = this.animationLoop.set(newTransition.endTime - (new Date()).getTime());
                if (oldTransition) this.animationLoop.cancel(oldTransition.loopID);
            }
        }
    }

    this.fire('change');
};


// Modify classes

Style.prototype.addClass = function(n) {
    this.classes[n] = true;
    this.recalculate();
};

Style.prototype.removeClass = function(n) {
    delete this.classes[n];
    this.recalculate();
};

Style.prototype.setClassList = function(l) {
    this.classes = {};
    for (var i = 0; i < l.length; i++) {
        this.classes[l] = true;
    }
    this.recalculate();
};

Style.prototype.getClassList = function() {
    return Object.keys(this.classes);
};
