'use strict';

var Evented = require('../util/evented');
var Source = require('../source/source');
var StyleTransition = require('./style_transition');
var StyleDeclaration = require('./style_declaration');
var StyleConstant = require('./style_constant');
var LayoutProperties = require('./layout_properties');
var PaintProperties = require('./paint_properties');
var ImageSprite = require('./image_sprite');
var GlyphSource = require('../symbol/glyph_source');
var GlyphAtlas = require('../symbol/glyph_atlas');
var util = require('../util/util');
var ajax = require('../util/ajax');
var browser = require('../util/browser');
var Dispatcher = require('../util/dispatcher');
var Point = require('point-geometry');

module.exports = Style;

/*
 * The map style's current state
 *
 * The stylesheet object is not modified. To change the style, just change
 * the the stylesheet object and trigger a cascade.
 */
function Style(stylesheet, animationLoop) {
    this.classes = {};
    this.animationLoop = animationLoop;
    this.dispatcher = new Dispatcher(Math.max(browser.hardwareConcurrency - 1, 1), this);
    this.glyphAtlas = new GlyphAtlas(1024, 1024);

    this.buckets = {};
    this.orderedBuckets = [];
    this.flattened = [];
    this.layerMap = {};
    this.layerGroups = [];
    this.processedPaintProps = {};
    this.transitions = {};
    this.computed = {};
    this.sources = {};

    util.bindAll([
        '_forwardSourceEvent',
        '_forwardTileEvent'
    ], this);

    var loaded = (err, stylesheet) => {
        if (err) {
            this.fire('error', {error: err});
            return;
        }

        this._loaded = true;
        this.stylesheet = stylesheet;

        if (stylesheet.version !== 6) console.warn('Stylesheet version must be 6');
        if (!Array.isArray(stylesheet.layers)) console.warn('Stylesheet must have layers');

        var sources = stylesheet.sources;
        for (var id in sources) {
            this.addSource(id, Source.create(sources[id]));
        }

        if (stylesheet.sprite) {
            this.sprite = new ImageSprite(stylesheet.sprite);
            this.sprite.on('load', this.fire.bind(this, 'change'));
        }

        this.glyphSource = new GlyphSource(stylesheet.glyphs, this.glyphAtlas);

        this.cascade({transition: false});
        this.fire('load');
    };

    if (typeof stylesheet === 'string') {
        ajax.getJSON(stylesheet, loaded);
    } else {
        browser.frame(loaded.bind(this, null, stylesheet));
    }
}

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

Style.prototype = util.inherit(Evented, {
    _loaded: false,

    loaded() {
        if (!this._loaded)
            return false;

        for (var id in this.sources)
            if (!this.sources[id].loaded())
                return false;

        if (this.sprite && !this.sprite.loaded())
            return false;

        return true;
    },

    recalculate(z) {
        if (typeof z !== 'number') console.warn('recalculate expects zoom level');

        var transitions = this.transitions;
        var layerValues = {};

        for (var id in this.sources)
            this.sources[id].used = false;

        this.rasterFadeDuration = 300;

        for (var name in transitions) {
            var layer = transitions[name],
                bucket = this.buckets[layer.ref || name],
                layerType = this.layerMap[name].type;

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
                if (source) this.sources[source].used = true;
            }

            if (appliedLayer['raster-fade-duration']) {
                this.rasterFadeDuration = Math.max(this.rasterFadeDuration, appliedLayer['raster-fade-duration']);
            }
        }

        this.computed = layerValues;

        this.z = z;
        this.fire('zoom');
    },

    _simpleLayer(layer) {
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
    },

    // Split the layers into groups of consecutive layers with the same datasource
    _groupLayers(layers) {
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
    },

    /*
     * Take all the rules and declarations from the stylesheet,
     * and figure out which apply currently
     */
    cascade(options) {
        var i,
            layer,
            id,
            prop,
            paintProp;

        var constants = this.stylesheet.constants;
        var globalTrans = this.stylesheet.transition;

        // derive buckets from layers
        this.orderedBuckets = [];
        this.buckets = getBuckets({}, this.orderedBuckets, this.stylesheet.layers);
        function getBuckets(buckets, ordered, layers) {
            for (var a = 0; a < layers.length; a++) {
                var layer = layers[a];
                if (layer.layers) {
                    buckets = getBuckets(buckets, ordered, layer.layers);
                }
                if (!layer.ref && (!layer.source || !layer.type)) {
                    continue;
                }
                var bucket = {id: layer.id};
                for (prop in layer) {
                    if ((/^paint/).test(prop)) continue;
                    bucket[prop] = layer[prop];
                }
                bucket.layout = StyleConstant.resolve(bucket.layout, constants);
                buckets[layer.id] = bucket;
                ordered.push(bucket);
            }
            return buckets;
        }
        this.dispatcher.broadcast('set buckets', this.orderedBuckets);

        // apply layer group inheritance resulting in a flattened array
        var flattened = this.flattened = flattenLayers(this.stylesheet.layers);

        // map layer ids to layer definitions for resolving refs
        var layerMap = this.layerMap = {};
        for (i = 0; i < flattened.length; i++) {
            layer = flattened[i];

            var newLayer = {};
            for (var k in layer) {
                if (k === 'layers') continue;
                newLayer[k] = layer[k];
            }

            layerMap[layer.id] = newLayer;
            flattened[i] = newLayer;
        }

        for (i = 0; i < flattened.length; i++) {
            flattened[i] = resolveLayer(layerMap, flattened[i]);
        }

        // pre-calculate style declarations and transition properties for all layers x all classes
        var processedPaintProps = this.processedPaintProps = {};
        for (i = 0; i < flattened.length; i++) {
            layer = flattened[i];
            id = layer.id;
            var renderType = layer.type;

            processedPaintProps[id] = {};
            for (prop in layer) {
                if (!(/^paint/).test(prop)) continue;
                var paint = StyleConstant.resolve(layer[prop], constants);

                // makes "" the key for the default paint property, which is a bit
                // unusual, but is valid JS and should work in all browsers
                var className = (prop === "paint") ? "" : prop.slice(6);
                var classProps = processedPaintProps[id][className] = {};
                for (paintProp in paint) {
                    var match = paintProp.match(/^(.*)-transition$/);
                    if (match) {
                        if (!classProps[match[1]]) classProps[match[1]] = {};
                        classProps[match[1]].transition = paint[paintProp];
                    } else {
                        if (!classProps[paintProp]) classProps[paintProp] = {};
                        classProps[paintProp].styleDeclaration = new StyleDeclaration(renderType, paintProp, paint[paintProp]);
                    }
                }

                // do a second pass to fill in missing transition properties & remove
                // transition properties without matching style declaration
                for (paintProp in classProps) {
                    if (!classProps[paintProp].styleDeclaration) {
                        delete classProps[paintProp];
                    } else {
                        var trans = classProps[paintProp].transition;
                        var newTrans = {};
                        newTrans.duration = trans && trans.duration >= 0 ? trans.duration :
                            globalTrans && globalTrans.duration >= 0 ? globalTrans.duration : 300;
                        newTrans.delay = trans && trans.delay >= 0 ? trans.delay :
                            globalTrans && globalTrans.delay >= 0 ? globalTrans.delay : 0;
                        classProps[paintProp].transition = newTrans;
                    }
                }
            }
        }

        this.layerGroups = this._groupLayers(this.stylesheet.layers);
        this.cascadeClasses(options);

        // Resolve layer references.
        function resolveLayer(layerMap, layer) {
            if (!layer.ref || !layerMap[layer.ref]) return layer;

            var parent = resolveLayer(layerMap, layerMap[layer.ref]);
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
    },

    cascadeClasses(options) {
        if (!this._loaded) return;

        options = options || {
            transition: true
        };

        var transitions = {};
        var processedPaintProps = this.processedPaintProps;
        var flattened = this.flattened;
        var classes = this.classes;

        for (var i = 0; i < flattened.length; i++) {
            var layer = flattened[i];
            var id = layer.id;
            transitions[id] = {};

            for (var className in processedPaintProps[id]) {
                if (!(className === "" || classes[className])) continue;
                var paintProps = processedPaintProps[id][className];
                for (var prop in paintProps) {
                    var newDeclaration = paintProps[prop].styleDeclaration;
                    var newStyleTrans = (options.transition) ? paintProps[prop].transition : {duration: 0, delay: 0};
                    var oldTransition = this.transitions[id] && this.transitions[id][prop];

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
        }

        this.transitions = transitions;
        this.fire('change');
    },

    addSource(id, source) {
        if (this.sources[id] !== undefined) {
            throw new Error('There is already a source with this ID');
        }
        this.sources[id] = source;
        source.id = id;
        source.style = this;
        source.dispatcher = this.dispatcher;
        source.glyphAtlas = this.glyphAtlas;
        source
            .on('load', this._forwardSourceEvent)
            .on('error', this._forwardSourceEvent)
            .on('change', this._forwardSourceEvent)
            .on('tile.add', this._forwardTileEvent)
            .on('tile.load', this._forwardTileEvent)
            .on('tile.error', this._forwardTileEvent)
            .on('tile.remove', this._forwardTileEvent);
        this.fire('source.add', {source: source});
        return this;
    },

    removeSource(id) {
        if (this.sources[id] === undefined) {
            throw new Error('There is no source with this ID');
        }
        var source = this.sources[id];
        delete this.sources[id];
        source
            .off('load', this._forwardSourceEvent)
            .off('error', this._forwardSourceEvent)
            .off('change', this._forwardSourceEvent)
            .off('tile.add', this._forwardTileEvent)
            .off('tile.load', this._forwardTileEvent)
            .off('tile.error', this._forwardTileEvent)
            .off('tile.remove', this._forwardTileEvent);
        this.fire('source.remove', {source: source});
        return this;
    },

    getSource(id) {
        return this.sources[id];
    },

    addClass(n, options) {
        if (this.classes[n]) return; // prevent unnecessary recalculation
        this.classes[n] = true;
        this.cascadeClasses(options);
    },

    removeClass(n, options) {
        if (!this.classes[n]) return; // prevent unnecessary recalculation
        delete this.classes[n];
        this.cascadeClasses(options);
    },

    hasClass(n) {
        return !!this.classes[n];
    },

    setClassList(l, options) {
        this.classes = {};
        for (var i = 0; i < l.length; i++) {
            this.classes[l[i]] = true;
        }
        this.cascadeClasses(options);
    },

    getClassList() {
        return Object.keys(this.classes);
    },

    getLayer(id) {
        return this.layerMap[id];
    },

    featuresAt(point, params, callback) {
        var features = [];
        var error = null;

        point = Point.convert(point);

        if (params.layer) {
            var layer = this.getLayer(params.layer);
            params.bucket = this.buckets[layer.ref || layer.id];
        }

        util.asyncEach(Object.keys(this.sources), (id, callback) => {
            var source = this.sources[id];
            source.featuresAt(point, params, function(err, result) {
                if (result) features = features.concat(result);
                if (err) error = err;
                callback();
            });
        }, () => {
            if (error) return callback(error);

            features.forEach((feature) => {
                var layer = feature.layer;
                layer.paint = this.computed[layer.id];
                layer.layout = new LayoutProperties[layer.type](layer.layout);
            });

            callback(null, features);
        });
    },

    _remove() {
        this.dispatcher.remove();
    },

    _updateSources() {
        for (var id in this.sources) {
            this.sources[id].update();
        }
    },

    _forwardSourceEvent(e) {
        this.fire('source.' + e.type, util.extend({source: e.target}, e));
    },

    _forwardTileEvent(e) {
        this.fire(e.type, util.extend({source: e.target}, e));
    },

    // Callbacks from web workers

    'get sprite json': function(params, callback) {
        var sprite = this.sprite;
        if (sprite.loaded()) {
            callback(null, { sprite: sprite.data, retina: sprite.retina });
        } else {
            sprite.on('load', function() {
                callback(null, { sprite: sprite.data, retina: sprite.retina });
            });
        }
    },

    'get glyphs': function(params, callback) {
        this.glyphSource.getRects(params.fontstack, params.codepoints, params.id, callback);
    }
});
