'use strict';

var evented = require('../lib/evented.js');

var StyleTransition = require('./styletransition.js');
var StyleDeclaration = require('./styledeclaration.js');
var ImageSprite = require('./imagesprite.js');

var assert = require('../util/assert.js');

module.exports = Style;

evented(Style);

/*
 * The map style's current state
 *
 * The stylesheet object is not modified. To change the style, just change
 * the the stylesheet object and trigger a cascade.
 */
function Style(stylesheet, animationLoop) {
    if (assert) assert.ok(typeof stylesheet.buckets === 'object', 'Stylesheet must have buckets');
    if (assert) assert.ok(Array.isArray(stylesheet.structure), 'Stylesheet must have structure array');

    this.classes = { 'default': true };
    this.stylesheet = stylesheet;
    this.animationLoop = animationLoop;

    this.layers = {};
    this.computed = {};

    this.cascade();

    this.fire('change:buckets');
    this.fire('change:structure');

    if (stylesheet.sprite) this.setSprite(stylesheet.sprite);
}

// Formerly known as zoomed styles
Style.prototype.recalculate = function(z) {
    if (assert) assert.ok(typeof z === 'number', 'recalculate has zoom level');

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

    this.computed = layerValues;
    this.z = z;
    this.fire('zoom');
};

/*
 * Take all the rules and declarations from the stylesheet,
 * and figure out which apply currently
 */
Style.prototype.cascade = function() {
    var newStyle = {};
    var name, prop, layer, declaration;

    var sheetClasses = this.stylesheet.classes;
    var transitions = {};

    if (!sheetClasses) return;

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

    var layers = {};

    // Calculate new transitions
    for (name in newStyle) {
        layer = newStyle[name];

        if (typeof layers[name] === 'undefined') layers[name] = {};

        for (prop in layer) {
            var newDeclaration = new StyleDeclaration(prop, layer[prop], this.stylesheet.constants);

            var oldTransition = this.layers[name] && this.layers[name][prop];
            var transition = transitions[name][prop];

            // Only create a new transition if the declaration changed
            if (!oldTransition || oldTransition.declaration.json !== newDeclaration.json) {
                var newTransition = new StyleTransition(newDeclaration, oldTransition, transition);
                layers[name][prop] = newTransition;

                // Run the animation loop until the end of the transition
                newTransition.loopID = this.animationLoop.set(newTransition.endTime - (new Date()).getTime());
                if (oldTransition) this.animationLoop.cancel(oldTransition.loopID);
            } else {
                layers[name][prop] = oldTransition;
            }
        }
    }

    this.layers = layers;

    // this.recalculate();
    this.fire('change');
};

/* This should be moved elsewhere. Localizing resources doesn't belong here */
Style.prototype.setSprite = function(sprite) {
    var style = this;
    this.sprite = new ImageSprite(sprite);
    this.sprite.on('loaded', function() {
        style.fire('change');
        style.fire('change:sprite');
    });
};


// Modify classes

Style.prototype.getDefaultClass = function() {
    var classes = this.stylesheet.classes;
    for (var i = 0; i < classes.length; i++) {
        if (classes[i].name === 'default') {
            return classes[i];
        }
    }
    assert.fail('Default class exists');
};

Style.prototype.addClass = function(n) {
    if (this.classes[n]) return; // prevent unnecessary recalculation
    this.classes[n] = true;
    this.cascade();
};

Style.prototype.removeClass = function(n) {
    if (!this.classes[n]) return; // prevent unnecessary recalculation
    delete this.classes[n];
    this.cascade();
};

Style.prototype.hasClass = function(n) {
    return !!this.classes[n];
};

Style.prototype.setClassList = function(l) {
    this.classes = { 'default': true };
    for (var i = 0; i < l.length; i++) {
        this.classes[l[i]] = true;
    }
    this.cascade();
};

Style.prototype.getClassList = function() {
    return Object.keys(this.classes).filter(function(d) { return d !== 'default'; });
};
