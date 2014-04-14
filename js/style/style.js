'use strict';

var Evented = require('../lib/evented.js');

var StyleTransition = require('./styletransition.js');
var StyleDeclaration = require('./styledeclaration.js');
var ImageSprite = require('./imagesprite.js');

var util = require('../util/util.js');

module.exports = Style;

/*
 * The map style's current state
 *
 * The stylesheet object is not modified. To change the style, just change
 * the the stylesheet object and trigger a cascade.
 */
function Style(stylesheet, animationLoop) {
    if (typeof stylesheet.buckets !== 'object') console.warn('Stylesheet must have buckets');
    if (!Array.isArray(stylesheet.layers)) console.warn('Stylesheet must have layers');

    this.classes = { 'default': true };
    this.stylesheet = stylesheet;
    this.animationLoop = animationLoop;

    this.layers = {};
    this.computed = {};
    this.sources = {};

    this.cascade();

    this.fire('change:buckets');

    if (stylesheet.sprite) this.setSprite(stylesheet.sprite);
}

Style.prototype = Object.create(Evented);

// Formerly known as zoomed styles
Style.prototype.recalculate = function(z) {
    if (typeof z !== 'number') console.warn('recalculate expects zoom level');

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
        // if (appliedLayer.opacity && appliedLayer.color) {
        //     appliedLayer.color = appliedLayer.color.slice();
        //     appliedLayer.color[3] = appliedLayer.opacity;
        //     util.premultiply(appliedLayer.color);
        // }

        // if (appliedLayer.opacity && appliedLayer.stroke) {
        //     appliedLayer.stroke = appliedLayer.stroke.slice();
        //     appliedLayer.stroke[3] = appliedLayer.opacity;
        //     util.premultiply(appliedLayer.stroke);
        // }

        // todo add more checks for width and color
        if (appliedLayer.opacity === 0) {
            appliedLayer.hidden = true;
        }

        if (appliedLayer.antialias === undefined) {
            appliedLayer.antialias = true;
        }
    }

    // Find all the sources that are currently being used
    // so that we can automatically enable/disable them as needed
    var buckets = this.stylesheet.buckets;
    var sources = this.sources = {};

    this.layerGroups = groupLayers(this.stylesheet.layers);


    // Split the layers into groups of consecutive layers with the same datasource
    // For each group calculate its dependencies. Its dependencies are composited
    // layers that need to be rendered into textures before
    function groupLayers(layers) {

        var i = layers.length - 1;
        var groups = [];

        // loop over layers top down
        while (i >= 0) {

            var layer = layers[i];
            var bucket = buckets[layer.id];
            var source = bucket && bucket.filter.source;

            var group = [];
            group.dependencies = {};
            group.source = source;
            group.composited = layer.layers;

            // low over layers top down until you reach one from a different datasource
            while (i >= 0) {
                layer = layers[i];
                bucket = buckets[layer.id];
                source = bucket && bucket.filter.source;

                var style = layerValues[layer.id];
                if (!style || style.hidden) {
                    i--;
                    continue;
                }

                // if the current layer is in a different source
                if (source !== group.source && layer.id !== 'background') break;

                if (layer.layers) {
                    // TODO if composited layer is opaque just inline the layers
                    group.dependencies[layer.id] = groupLayers(layer.layers);

                } else {
                    // mark source as used so that tiles are downloaded
                    if (source) sources[source] = true;
                }

                group.push(layer);
                i--;
            }

            groups.push(group);
        }
        return groups;
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

    var sheetClasses = this.stylesheet.styles;
    var transitions = {};

    if (!sheetClasses) return;

    // Recalculate style
    // Basic cascading
    for (var className in sheetClasses) {
        // Not enabled
        if (!this.classes[className]) continue;

        for (name in sheetClasses[className]) {
            layer = sheetClasses[className][name];

            newStyle[name] = newStyle[name] || {};
            transitions[name] = transitions[name] || {};

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


Style.prototype.getDefaultClass = function() {
    var klass = this.getClass('default');
    if (!klass) console.warn('No default class');
    return klass;
};

Style.prototype.getClass = function(name) {
    var classes = this.stylesheet.styles;
    for (var i = 0; i < classes.length; i++) {
        if (classes[i].name === name) {
            return classes[i];
        }
    }
};

// Modify classes
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
