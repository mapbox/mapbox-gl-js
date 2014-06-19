'use strict';

var Evented = require('../util/evented.js');

var StyleTransition = require('./styletransition.js');
var StyleDeclaration = require('./styledeclaration.js');
var CalculatedStyle = require('./calculatedstyle.js');
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
    if (stylesheet.version !== 3) console.warn('Stylesheet version must be 3');
    if (!Array.isArray(stylesheet.layers)) console.warn('Stylesheet must have layers');

    this.classes = { 'default': true };
    this.stylesheet = stylesheet;
    this.animationLoop = animationLoop;

    this.buckets = {};
    this.layers = {};
    this.computed = {};
    this.sources = {};

    this.cascade();

    this.fire('change:buckets');

    if (stylesheet.sprite) this.setSprite(stylesheet.sprite);
}

Style.prototype = Object.create(Evented);

function premultiplyLayer(layer, type) {
    var colorProp = type + '-color',
        color = layer[colorProp],
        opacity = layer[type + '-opacity'];

    if (opacity === 0) {
        layer.hidden = true;
    } else if (color && opacity) {
        layer[colorProp] = util.premultiply([color[0], color[1], color[2], opacity * color[3]]);
    }
}

// Formerly known as zoomed styles
Style.prototype.recalculate = function(z) {
    if (typeof z !== 'number') console.warn('recalculate expects zoom level');

    var layers = this.layers;
    var layerValues = {};

    this.rasterFadeDuration = 300;

    for (var name in layers) {
        var layer = layers[name];

        var layerType = this.layermap[name].render.type;

        var appliedLayer = layerValues[name] = new CalculatedStyle[layerType]();
        for (var rule in layer) {
            var transition = layer[rule];
            appliedLayer[rule] = transition.at(z);
        }

        premultiplyLayer(appliedLayer, layerType);

        if (appliedLayer['raster-fade']) {
            this.rasterFadeDuration = Math.max(this.rasterFadeDuration, appliedLayer['raster-fade']);
        }
    }

    // Find all the sources that are currently being used
    // so that we can automatically enable/disable them as needed
    var buckets = this.buckets;
    var sources = this.sources = {};

    this.layerGroups = groupLayers(this.stylesheet.layers);

    function simpleLayer(layer) {
        var bucket = buckets[layer.ref||layer.id];
        var simple = {};
        simple.id = layer.id;
        if (bucket) simple.bucket = bucket.id;
        if (layer.layers) simple.layers = layer.layers.map(simpleLayer);
        return simple;
    }

    // Split the layers into groups of consecutive layers with the same datasource
    // For each group calculate its dependencies. Its dependencies are composited
    // layers that need to be rendered into textures before
    function groupLayers(layers) {
        var g = 0;
        var groups = [];
        var group;

        // loop over layers top down
        for (var i = layers.length - 1; i >= 0; i--) {
            var layer = layers[i];
            var bucket = buckets[layer.ref||layer.id];
            var source = bucket && bucket.source;

            // if the current layer is in a different source
            if (group && source !== group.source && layer.id !== 'background') g++;

            if (!groups[g]) {
                group = [];
                group.dependencies = {};
                group.source = source;
                group.composited = layer.layers && layer.layers.map(simpleLayer);
                groups[g] = group;
            }

            var style = layerValues[layer.id];
            if (!style || style.hidden) continue;

            if (layer.layers) {
                // TODO if composited layer is opaque just inline the layers
                group.dependencies[layer.id] = groupLayers(layer.layers);
            } else {
                // mark source as used so that tiles are downloaded
                if (source) sources[source] = true;
            }

            group.push(simpleLayer(layer));
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
    var a, b;
    var id;
    var prop;
    var layer;
    var className;
    var styleName;
    var style;
    var styleTrans;

    // derive buckets from layers
    this.buckets = getbuckets({}, this.stylesheet.layers);
    function getbuckets(buckets, layers) {
        for (var a = 0; a < layers.length; a++) {
            layer = layers[a];
            if (layer.layers) {
                buckets = getbuckets(buckets, layer.layers);
            } else if (!layer.source || !layer.render) {
                continue;
            }
            var bucket = {};
            for (var prop in layer) {
                if ((/^style/).test(prop)) continue;
                bucket[prop] = layer[prop];
            }
            buckets[layer.id] = bucket;
        }
        return buckets;
    }

    // style class keys
    var styleNames = ['style'];
    for (className in this.classes) styleNames.push('style.' + className);

    // apply layer group inheritance resulting in a flattened array
    var flattened = flattenLayers(this.stylesheet.layers);

    // map layer ids to layer definitions for resolving refs
    var layermap = this.layermap = {};
    for (a = 0; a < flattened.length; a++) {
        layer = flattened[a];

        var newLayer = {};
        for (var k in layer) {
            if (k === 'layers') continue;
            newLayer[k] = layer[k];
        }

        layermap[layer.id] = newLayer;
        flattened[a] = newLayer;
    }

    for (a = 0; a < flattened.length; a++) {
        flattened[a] = resolveLayer(layermap, flattened[a]);
    }

    // Resolve layer references.
    function resolveLayer(layermap, layer) {
        if (!layer.ref || !layermap[layer.ref]) return layer;

        var parent = resolveLayer(layermap, layermap[layer.ref]);
        layer.render = parent.render;
        layer.filter = parent.filter;
        layer.source = parent.source;
        layer['source-layer'] = parent['source-layer'];

        return layer;
    }

    // Flatten composite layer structures.
    function flattenLayers(layers) {
        var flat = [];
        for (var i = 0; i < layers.length; i++) {
            flat.push(layers[i]);
            if (layers[i].layers) {
                flat.push.apply(flat, flattenLayers(layers[i].layers));
            }
        }
        return flat;
    }

    var layers = {};

    for (a in flattened) {
        layer = flattened[a];

        id = layer.id;
        style = {};
        styleTrans = {};

        // basic cascading of styles
        for (b = 0; b < styleNames.length; b++) {
            styleName = styleNames[b];
            if (!layer[styleName]) continue;
            // set style properties
            for (prop in layer[styleName]) {
                if (prop.indexOf('transition-') === -1) {
                    style[prop] = layer[styleName][prop];
                } else {
                    styleTrans[prop.replace('transition-', '')] = layer[styleName][prop];
                }
            }
        }

        layers[id] = {};
        for (prop in style) {
            var newDeclaration = new StyleDeclaration(prop, style[prop], this.stylesheet.constants);
            var oldTransition = this.layers[id] && this.layers[id][prop];
            var newStyleTrans = styleTrans[prop] || { delay: 0, duration: 300 };

            // Only create a new transition if the declaration changed
            if (!oldTransition || oldTransition.declaration.json !== newDeclaration.json) {
                var newTransition = new StyleTransition(newDeclaration, oldTransition, newStyleTrans);
                layers[id][prop] = newTransition;

                // Run the animation loop until the end of the transition
                newTransition.loopID = this.animationLoop.set(newTransition.endTime - (new Date()).getTime());
                if (oldTransition) this.animationLoop.cancel(oldTransition.loopID);
            } else {
                layers[id][prop] = oldTransition;
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
