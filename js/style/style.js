'use strict';

var Evented = require('../util/evented');
var StyleTransition = require('./style_transition');
var StyleDeclaration = require('./style_declaration');
var StyleConstant = require('./style_constant');
var PaintProperties = require('./paint_properties');
var ImageSprite = require('./image_sprite');
var util = require('../util/util');

module.exports = Style;

/*
 * The map style's current state
 *
 * The stylesheet object is not modified. To change the style, just change
 * the the stylesheet object and trigger a cascade.
 */
function Style(stylesheet, animationLoop) {
    if (stylesheet.version !== 6) console.warn('Stylesheet version must be 6');
    if (!Array.isArray(stylesheet.layers)) console.warn('Stylesheet must have layers');

    this.classes = {};
    this.stylesheet = stylesheet;
    this.animationLoop = animationLoop;

    this.buckets = {};
    this.orderedBuckets = [];
    this.transitions = {};
    this.computed = {};
    this.sources = {};

    this.cascade({transition: false});

    if (stylesheet.sprite) this.setSprite(stylesheet.sprite);
}

Style.prototype = Object.create(Evented);

function premultiplyLayer(layer, type) {
    var colorProp = type + '-color',
        haloProp = type + '-halo-color',
        outlineProp = type + '-outline-color',
        color = layer[colorProp],
        haloColor = layer[haloProp],
        outlineColor = layer[outlineProp],
        opacity = layer[type + '-opacity'];

    var colorOpacity = color && (opacity * color[3]);
    var haloOpacity = haloColor && (opacity * haloColor[3]);
    var outlineOpacity = outlineColor && (opacity * outlineColor[3]);

    if (colorOpacity !== undefined && colorOpacity < 1) {
        layer[colorProp] = util.premultiply([color[0], color[1], color[2], colorOpacity]);
    }
    if (haloOpacity !== undefined && haloOpacity < 1) {
        layer[haloProp] = util.premultiply([haloColor[0], haloColor[1], haloColor[2], haloOpacity]);
    }
    if (outlineOpacity !== undefined && outlineOpacity < 1) {
        layer[outlineProp] = util.premultiply([outlineColor[0], outlineColor[1], outlineColor[2], outlineOpacity]);
    }
}

// Formerly known as zoomed styles
Style.prototype.recalculate = function(z) {
    if (typeof z !== 'number') console.warn('recalculate expects zoom level');

    var transitions = this.transitions;
    var layerValues = {};

    this.sources = {};

    this.rasterFadeDuration = 300;

    for (var name in transitions) {
        var layer = transitions[name],
            bucket = this.buckets[layer.ref || name],
            layerType = this.layermap[name].type;

        if (!PaintProperties[layerType]) {
            console.warn('unknown layer type ' + layerType);
            continue;
        }
        var appliedLayer = layerValues[name] = new PaintProperties[layerType]();
        for (var rule in layer) {
            var transition = layer[rule];
            appliedLayer[rule] = transition.at(z);
        }

        if (layerType === 'symbol') {
            if ((appliedLayer['text-opacity'] === 0 || !bucket.layout['text-field']) &&
                (appliedLayer['icon-opacity'] === 0 || !bucket.layout['icon-image'])) {
                appliedLayer.hidden = true;
            } else {
                premultiplyLayer(appliedLayer, 'text');
                premultiplyLayer(appliedLayer, 'icon');
            }
        } else {
            if (appliedLayer[layerType + '-opacity'] === 0) {
                appliedLayer.hidden = true;
            } else {
                premultiplyLayer(appliedLayer, layerType);
            }
        }

        // Find all the sources that are currently being used
        // so that we can automatically enable/disable them as needed
        if (!appliedLayer.hidden) {
            var source = bucket && bucket.source;

            // mark source as used so that tiles are downloaded
            if (source) this.sources[source] = true;
        }

        if (appliedLayer['raster-fade-duration']) {
            this.rasterFadeDuration = Math.max(this.rasterFadeDuration, appliedLayer['raster-fade-duration']);
        }
    }

    this.computed = layerValues;

    this.z = z;
    this.fire('zoom');
};

Style.prototype._simpleLayer = function(layer) {
    var simple = {};
    simple.id = layer.id;

    var bucket = this.buckets[layer.ref || layer.id];
    if (bucket) simple.bucket = bucket.id;
    if (layer.type) simple.type = layer.type;

    if (layer.layers) {
        simple.layers = [];
        for (var i = 0; i < layer.layers.length; i++) {
            simple.layers.push(this._simpleLayer(layer.layers[i]));
        }
    }
    return simple;
};

// Split the layers into groups of consecutive layers with the same datasource
Style.prototype._groupLayers = function(layers) {
    var g = 0;
    var groups = [];
    var group;

    // loop over layers top down
    for (var i = layers.length - 1; i >= 0; i--) {
        var layer = layers[i];

        var bucket = this.buckets[layer.ref || layer.id];
        var source = bucket && bucket.source;

        // if the current layer is in a different source
        if (group && source !== group.source) g++;

        if (!groups[g]) {
            group = [];
            group.source = source;
            groups[g] = group;
        }

        group.push(this._simpleLayer(layer));
    }

    return groups;
};

/*
 * Take all the rules and declarations from the stylesheet,
 * and figure out which apply currently
 */
Style.prototype.cascade = function(options) {
    options = options || {
        transition: true
    };

    var i, b;
    var id;
    var prop;
    var layer;
    var className;
    var paintName;
    var paintProps;
    var transProps;
    var constants = this.stylesheet.constants;

    // derive buckets from layers
    this.orderedBuckets = [];
    this.buckets = getbuckets({}, this.orderedBuckets, this.stylesheet.layers);
    function getbuckets(buckets, ordered, layers) {
        for (var a = 0; a < layers.length; a++) {
            var layer = layers[a];
            if (layer.layers) {
                buckets = getbuckets(buckets, ordered, layer.layers);
            }
            if (!layer.source || !layer.type) {
                continue;
            }
            var bucket = { id: layer.id };
            for (var prop in layer) {
                if ((/^paint/).test(prop)) continue;
                bucket[prop] = layer[prop];
            }
            bucket.layout = StyleConstant.resolve(bucket.layout, constants);
            buckets[layer.id] = bucket;
            ordered.push(bucket);
        }
        return buckets;
    }

    // class keys
    var paintNames = ['paint'];
    for (className in this.classes) paintNames.push('paint.' + className);

    // apply layer group inheritance resulting in a flattened array
    var flattened = flattenLayers(this.stylesheet.layers);

    // map layer ids to layer definitions for resolving refs
    var layermap = this.layermap = {};
    for (i = 0; i < flattened.length; i++) {
        layer = flattened[i];

        var newLayer = {};
        for (var k in layer) {
            if (k === 'layers') continue;
            newLayer[k] = layer[k];
        }

        layermap[layer.id] = newLayer;
        flattened[i] = newLayer;
    }

    for (i = 0; i < flattened.length; i++) {
        flattened[i] = resolveLayer(layermap, flattened[i]);
    }

    // Resolve layer references.
    function resolveLayer(layermap, layer) {
        if (!layer.ref || !layermap[layer.ref]) return layer;

        var parent = resolveLayer(layermap, layermap[layer.ref]);
        layer.layout = parent.layout;
        layer.type = parent.type;
        layer.filter = parent.filter;
        layer.source = parent.source;
        layer['source-layer'] = parent['source-layer'];
        layer.minzoom = parent.minzoom;
        layer.maxzoom = parent.maxzoom;

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

    for (i = 0; i < flattened.length; i++) {
        layer = flattened[i];

        id = layer.id;
        paintProps = {};
        transProps = {};

        // basic cascading of paint properties
        for (b = 0; b < paintNames.length; b++) {
            paintName = paintNames[b];
            if (!layer[paintName]) continue;
            // set paint properties
            for (prop in layer[paintName]) {
                var match = prop.match(/^(.*)-transition$/);
                if (match) {
                    transProps[match[1]] = layer[paintName][prop];
                } else {
                    paintProps[prop] = layer[paintName][prop];
                }
            }
        }

        paintProps = StyleConstant.resolve(paintProps, constants);

        var renderType = layer.type;
        transitions[id] = {};

        for (prop in paintProps) {
            var newDeclaration = new StyleDeclaration(renderType, prop, paintProps[prop]);
            var oldTransition = this.transitions[id] && this.transitions[id][prop];
            var newStyleTrans = {};
            newStyleTrans.duration = transProps[prop] && transProps[prop].duration ? transProps[prop].duration : globalTrans && globalTrans.duration ? globalTrans.duration : 300;
            newStyleTrans.delay = transProps[prop] && transProps[prop].delay ? transProps[prop].delay : globalTrans && globalTrans.delay ? globalTrans.delay : 0;

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
    this.layerGroups = this._groupLayers(this.stylesheet.layers);

    this.fire('change');
};

/* This should be moved elsewhere. Localizing resources doesn't belong here */
Style.prototype.setSprite = function(sprite) {
    this.sprite = new ImageSprite(sprite);
    this.sprite.on('loaded', this.fire.bind(this, 'change'));
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
    this.classes = {};
    for (var i = 0; i < l.length; i++) {
        this.classes[l[i]] = true;
    }
    this.cascade(options);
};

Style.prototype.getClassList = function() {
    return Object.keys(this.classes);
};

Style.prototype.getLayer = function(id) {
    return this.layermap[id];
};
