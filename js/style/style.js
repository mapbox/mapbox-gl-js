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
    if (stylesheet.version !== 4) console.warn('Stylesheet version must be 4');
    if (!Array.isArray(stylesheet.layers)) console.warn('Stylesheet must have layers');

    this.classes = { 'default': true };
    this.stylesheet = stylesheet;
    this.animationLoop = animationLoop;

    this.buckets = {};
    this.orderedBuckets = [];
    this.transitions = {};
    this.computed = {};
    this.sources = {};

    this.cascade({transition: false});

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

    var haloColor = layer[type + '-halo-color'];
    if (haloColor) {
        layer[type + '-halo-color'] = util.premultiply([haloColor[0], haloColor[1], haloColor[2], opacity * haloColor[3]]);
    }
}

// Formerly known as zoomed styles
Style.prototype.recalculate = function(z) {
    if (typeof z !== 'number') console.warn('recalculate expects zoom level');

    var transitions = this.transitions;
    var layerValues = {};

    this.rasterFadeDuration = 300;

    for (var name in transitions) {
        var layer = transitions[name];

        var layerType = this.layermap[name].type;

        if (!CalculatedStyle[layerType]) {
            console.warn('unknown layer type ' + layerType);
            continue;
        }
        var appliedLayer = layerValues[name] = new CalculatedStyle[layerType]();
        for (var rule in layer) {
            var transition = layer[rule];
            appliedLayer[rule] = transition.at(z);
        }

        if (layerType === 'symbol') {
            premultiplyLayer(appliedLayer, 'text');
            premultiplyLayer(appliedLayer, 'icon');
        } else {
            premultiplyLayer(appliedLayer, layerType);
        }

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
            if (group && source !== group.source) g++;

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
Style.prototype.cascade = function(options) {
    options = options || {
        transition: true
    };

    var a, b;
    var id;
    var prop;
    var layer;
    var className;
    var styleName;
    var style;
    var styleTrans;

    // derive buckets from layers
    this.orderedBuckets = [];
    this.buckets = getbuckets({}, this.orderedBuckets, this.stylesheet.layers);
    function getbuckets(buckets, ordered, layers) {
        for (var a = 0; a < layers.length; a++) {
            var layer = layers[a];
            if (layer.layers) {
                buckets = getbuckets(buckets, ordered, layer.layers);
                continue;
            } else if (!layer.source || !layer.type) {
                continue;
            }
            var bucket = { id: layer.id };
            for (var prop in layer) {
                if ((/^style/).test(prop)) continue;
                bucket[prop] = layer[prop];
            }
            buckets[layer.id] = bucket;
            ordered.push(bucket);
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
        layer.type = parent.type;
        layer.filter = parent.filter;
        layer.source = parent.source;
        layer['source-layer'] = parent['source-layer'];
        layer['min-zoom'] = parent['min-zoom'];
        layer['max-zoom'] = parent['max-zoom'];

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

    var transitions = {};
    var globalTrans = this.stylesheet.transition;

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

        var renderType = layer.type;

        transitions[id] = {};
        for (prop in style) {
            var newDeclaration = new StyleDeclaration(renderType, prop, style[prop], this.stylesheet.constants);
            var oldTransition = this.transitions[id] && this.transitions[id][prop];
            var newStyleTrans = {};
            newStyleTrans.duration = styleTrans[prop] && styleTrans[prop].duration ? styleTrans[prop].duration : globalTrans && globalTrans.duration ? globalTrans.duration : 300;
            newStyleTrans.delay = styleTrans[prop] && styleTrans[prop].delay ? styleTrans[prop].delay : globalTrans && globalTrans.delay ? globalTrans.delay : 0;

            if (!options.transition) {
                newStyleTrans.duration = 0;
                newStyleTrans.delay = 0;
            }

            // Only create a new transition if the declaration changed
            if (!oldTransition || oldTransition.declaration.json !== newDeclaration.json) {
                var newTransition = new StyleTransition(newDeclaration, oldTransition, newStyleTrans);
                transitions[id][prop] = newTransition;

                // Run the animation loop until the end of the transition
                if (!newTransition.instant()) {
                    newTransition.loopID = this.animationLoop.set(newTransition.endTime - (new Date()).getTime());
                }

                if (oldTransition) {
                    this.animationLoop.cancel(oldTransition.loopID);
                }
            } else {
                transitions[id][prop] = oldTransition;
            }
        }
    }

    this.transitions = transitions;

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

Style.prototype.getClass = function(name) {
    var classes = this.stylesheet.styles;
    for (var i = 0; i < classes.length; i++) {
        if (classes[i].name === name) {
            return classes[i];
        }
    }
};

// Modify classes
Style.prototype.addClass = function(n, options) {
    if (this.classes[n]) return; // prevent unnecessary recalculation
    this.classes[n] = true;
    this.cascade(options);
};

Style.prototype.removeClass = function(n, options) {
    if (!this.classes[n]) return; // prevent unnecessary recalculation
    delete this.classes[n];
    this.cascade(options);
};

Style.prototype.hasClass = function(n) {
    return !!this.classes[n];
};

Style.prototype.setClassList = function(l, options) {
    this.classes = { 'default': true };
    for (var i = 0; i < l.length; i++) {
        this.classes[l[i]] = true;
    }
    this.cascade(options);
};

Style.prototype.getClassList = function() {
    return Object.keys(this.classes).filter(function(d) { return d !== 'default'; });
};

Style.prototype.getLayer = function(id, layers) {
    layers = layers || this.stylesheet.layers;

    for (var i = 0; i < layers.length; i++) {
        if (layers[i].id === id) return layers[i];
        if (layers[i].layers) {
            var layer = this.getLayer(id, layers[i].layers);
            if (layer) return layer;
        }
    }
    return null;
};
