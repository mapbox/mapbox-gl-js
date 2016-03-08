'use strict';

var Evented = require('../util/evented');
var styleBatch = require('./style_batch');
var StyleLayer = require('./style_layer');
var ImageSprite = require('./image_sprite');
var GlyphSource = require('../symbol/glyph_source');
var SpriteAtlas = require('../symbol/sprite_atlas');
var LineAtlas = require('../render/line_atlas');
var util = require('../util/util');
var ajax = require('../util/ajax');
var normalizeURL = require('../util/mapbox').normalizeStyleURL;
var browser = require('../util/browser');
var Dispatcher = require('../util/dispatcher');
var AnimationLoop = require('./animation_loop');
var validateStyle = require('./validate_style');

module.exports = Style;

function Style(stylesheet, animationLoop) {
    this.animationLoop = animationLoop || new AnimationLoop();
    this.dispatcher = new Dispatcher(Math.max(browser.hardwareConcurrency - 1, 1), this);
    this.spriteAtlas = new SpriteAtlas(512, 512);
    this.lineAtlas = new LineAtlas(256, 512);

    this._layers = {};
    this._order  = [];
    this._groups = [];
    this.sources = {};

    this.zoomHistory = {};

    util.bindAll([
        '_forwardSourceEvent',
        '_forwardTileEvent',
        '_forwardLayerEvent',
        '_redoPlacement'
    ], this);

    var loaded = function(err, stylesheet) {
        if (err) {
            this.fire('error', {error: err});
            return;
        }

        if (validateStyle.emitErrors(this, validateStyle(stylesheet))) return;

        this._loaded = true;
        this.stylesheet = stylesheet;

        var sources = stylesheet.sources;
        for (var id in sources) {
            this.addSource(id, sources[id]);
        }

        if (stylesheet.sprite) {
            this.sprite = new ImageSprite(stylesheet.sprite);
            this.sprite.on('load', this.fire.bind(this, 'change'));
        }

        this.glyphSource = new GlyphSource(stylesheet.glyphs);
        this._resolve();
        this.fire('load');
    }.bind(this);

    if (typeof stylesheet === 'string') {
        ajax.getJSON(normalizeURL(stylesheet), loaded);
    } else {
        browser.frame(loaded.bind(this, null, stylesheet));
    }

    this.on('source.load', function(event) {
        var source = event.source;
        if (source && source.vectorLayerIds) {
            for (var layerId in this._layers) {
                var layer = this._layers[layerId];
                if (layer.source === source.id) {
                    this._validateLayer(layer);
                }
            }
        }
    });
}

Style.prototype = util.inherit(Evented, {
    _loaded: false,

    _validateLayer: function(layer) {
        var source = this.sources[layer.source];

        if (!layer.sourceLayer) return;
        if (!source) return;
        if (!source.vectorLayerIds) return;

        if (source.vectorLayerIds.indexOf(layer.sourceLayer) === -1) {
            this.fire('error', {
                error: new Error(
                    'Source layer "' + layer.sourceLayer + '" ' +
                    'does not exist on source "' + source.id + '" ' +
                    'as specified by style layer "' + layer.id + '"'
                )
            });
        }
    },

    loaded: function() {
        if (!this._loaded)
            return false;

        for (var id in this.sources)
            if (!this.sources[id].loaded())
                return false;

        if (this.sprite && !this.sprite.loaded())
            return false;

        return true;
    },

    _resolve: function() {
        var layer, layerJSON;

        this._layers = {};
        this._order  = this.stylesheet.layers.map(function(layer) {
            return layer.id;
        });

        // resolve all layers WITHOUT a ref
        for (var i = 0; i < this.stylesheet.layers.length; i++) {
            layerJSON = this.stylesheet.layers[i];
            if (layerJSON.ref) continue;
            layer = StyleLayer.create(layerJSON);
            this._layers[layer.id] = layer;
            layer.on('error', this._forwardLayerEvent);
        }

        // resolve all layers WITH a ref
        for (var j = 0; j < this.stylesheet.layers.length; j++) {
            layerJSON = this.stylesheet.layers[j];
            if (!layerJSON.ref) continue;
            var refLayer = this.getLayer(layerJSON.ref);
            layer = StyleLayer.create(layerJSON, refLayer);
            this._layers[layer.id] = layer;
            layer.on('error', this._forwardLayerEvent);
        }

        this._groupLayers();
        this._broadcastLayers();
    },

    _groupLayers: function() {
        var group;

        this._groups = [];

        // Split into groups of consecutive top-level layers with the same source.
        for (var i = 0; i < this._order.length; ++i) {
            var layer = this._layers[this._order[i]];

            if (!group || layer.source !== group.source) {
                group = [];
                group.source = layer.source;
                this._groups.push(group);
            }

            group.push(layer);
        }
    },

    _broadcastLayers: function(ids) {
        this.dispatcher.broadcast(ids ? 'update layers' : 'set layers', this._serializeLayers(ids));
    },

    _serializeLayers: function(ids) {
        ids = ids || this._order;
        var serialized = [];
        var options = {includeRefProperties: true};
        for (var i = 0; i < ids.length; i++) {
            serialized.push(this._layers[ids[i]].serialize(options));
        }
        return serialized;
    },

    _cascade: function(classes, options) {
        if (!this._loaded) return;

        options = options || {
            transition: true
        };

        for (var id in this._layers) {
            this._layers[id].cascade(classes, options,
                this.stylesheet.transition || {},
                this.animationLoop);
        }

        this.fire('change');
    },

    _recalculate: function(z) {
        for (var sourceId in this.sources)
            this.sources[sourceId].used = false;

        this._updateZoomHistory(z);

        this.rasterFadeDuration = 300;
        for (var layerId in this._layers) {
            var layer = this._layers[layerId];

            layer.recalculate(z, this.zoomHistory);
            if (!layer.isHidden(z) && layer.source) {
                this.sources[layer.source].used = true;
            }
        }

        var maxZoomTransitionDuration = 300;
        if (Math.floor(this.z) !== Math.floor(z)) {
            this.animationLoop.set(maxZoomTransitionDuration);
        }

        this.z = z;
        this.fire('zoom');
    },

    _updateZoomHistory: function(z) {

        var zh = this.zoomHistory;

        if (zh.lastIntegerZoom === undefined) {
            // first time
            zh.lastIntegerZoom = Math.floor(z);
            zh.lastIntegerZoomTime = 0;
            zh.lastZoom = z;
        }

        // check whether an integer zoom level as passed since the last frame
        // and if yes, record it with the time. Used for transitioning patterns.
        if (Math.floor(zh.lastZoom) < Math.floor(z)) {
            zh.lastIntegerZoom = Math.floor(z);
            zh.lastIntegerZoomTime = Date.now();

        } else if (Math.floor(zh.lastZoom) > Math.floor(z)) {
            zh.lastIntegerZoom = Math.floor(z + 1);
            zh.lastIntegerZoomTime = Date.now();
        }

        zh.lastZoom = z;
    },

    /**
     * Apply multiple style mutations in a batch
     * @param {function} work Function which accepts the StyleBatch interface
     * @private
     */
    batch: function(work) {
        styleBatch(this, work);
    },

    addSource: function(id, source) {
        this.batch(function(batch) {
            batch.addSource(id, source);
        });

        return this;
    },

    /**
     * Remove a source from this stylesheet, given its id.
     * @param {string} id id of the source to remove
     * @returns {Style} this style
     * @throws {Error} if no source is found with the given ID
     * @private
     */
    removeSource: function(id) {
        this.batch(function(batch) {
            batch.removeSource(id);
        });

        return this;
    },

    /**
     * Get a source by id.
     * @param {string} id id of the desired source
     * @returns {Object} source
     * @private
     */
    getSource: function(id) {
        return this.sources[id];
    },

    /**
     * Add a layer to the map style. The layer will be inserted before the layer with
     * ID `before`, or appended if `before` is omitted.
     * @param {StyleLayer|Object} layer
     * @param {string=} before  ID of an existing layer to insert before
     * @fires layer.add
     * @returns {Style} `this`
     * @private
     */
    addLayer: function(layer, before) {
        this.batch(function(batch) {
            batch.addLayer(layer, before);
        });

        return this;
    },

    /**
     * Remove a layer from this stylesheet, given its id.
     * @param {string} id id of the layer to remove
     * @returns {Style} this style
     * @throws {Error} if no layer is found with the given ID
     * @private
     */
    removeLayer: function(id) {
        this.batch(function(batch) {
            batch.removeLayer(id);
        });

        return this;
    },

    /**
     * Return the style layer object with the given `id`.
     *
     * @param {string} id - id of the desired layer
     * @returns {?Object} a layer, if one with the given `id` exists
     * @private
     */
    getLayer: function(id) {
        return this._layers[id];
    },

    /**
     * If a layer has a `ref` property that makes it derive some values
     * from another layer, return that referent layer. Otherwise,
     * returns the layer itself.
     * @param {string} id the layer's id
     * @returns {Layer} the referent layer or the layer itself
     * @private
     */
    getReferentLayer: function(id) {
        var layer = this.getLayer(id);
        if (layer.ref) {
            layer = this.getLayer(layer.ref);
        }
        return layer;
    },

    setFilter: function(layer, filter) {
        this.batch(function(batch) {
            batch.setFilter(layer, filter);
        });

        return this;
    },

    setLayerZoomRange: function(layerId, minzoom, maxzoom) {
        this.batch(function(batch) {
            batch.setLayerZoomRange(layerId, minzoom, maxzoom);
        });

        return this;
    },

    /**
     * Get a layer's filter object
     * @param {string} layer the layer to inspect
     * @returns {*} the layer's filter, if any
     * @private
     */
    getFilter: function(layer) {
        return this.getReferentLayer(layer).filter;
    },

    /**
     * Get a layout property's value from a given layer
     * @param {string} layer the layer to inspect
     * @param {string} name the name of the layout property
     * @returns {*} the property value
     * @private
     */
    getLayoutProperty: function(layer, name) {
        return this.getReferentLayer(layer).getLayoutProperty(name);
    },

    getPaintProperty: function(layer, name, klass) {
        return this.getLayer(layer).getPaintProperty(name, klass);
    },

    serialize: function() {
        return util.filterObject({
            version: this.stylesheet.version,
            name: this.stylesheet.name,
            metadata: this.stylesheet.metadata,
            center: this.stylesheet.center,
            zoom: this.stylesheet.zoom,
            bearing: this.stylesheet.bearing,
            pitch: this.stylesheet.pitch,
            sprite: this.stylesheet.sprite,
            glyphs: this.stylesheet.glyphs,
            transition: this.stylesheet.transition,
            sources: util.mapObject(this.sources, function(source) {
                return source.serialize();
            }),
            layers: this._order.map(function(id) {
                return this._layers[id].serialize();
            }, this)
        }, function(value) { return value !== undefined; });
    },

    _flattenRenderedFeatures: function(sourceResults) {
        var features = [];
        for (var l = this._order.length - 1; l >= 0; l--) {
            var layerID = this._order[l];
            for (var s = 0; s < sourceResults.length; s++) {
                var layerFeatures = sourceResults[s][layerID];
                if (layerFeatures) {
                    for (var f = 0; f < layerFeatures.length; f++) {
                        features.push(layerFeatures[f]);
                    }
                }
            }
        }
        return features;
    },

    queryRenderedFeatures: function(queryGeometry, params, classes, zoom, bearing, callback) {
        if (params.layer) {
            params.layerIDs = Array.isArray(params.layer) ? params.layer : [params.layer];
        }

        var isAsync = callback !== undefined;

        if (isAsync) {
            util.asyncAll(Object.keys(this.sources), function(id, callback) {
                this.sources[id].queryRenderedFeatures(queryGeometry, params, classes, zoom, bearing, callback);
            }.bind(this), function(err, sourceResults) {
                if (err) return callback(err);
                callback(null, this._flattenRenderedFeatures(sourceResults));
            }.bind(this));
        } else {
            var sourceResults = [];
            for (var id in this.sources) {
                sourceResults.push(this.sources[id].queryRenderedFeatures(queryGeometry, params, classes, zoom, bearing));
            }
            return this._flattenRenderedFeatures(sourceResults);
        }
    },

    _remove: function() {
        this.dispatcher.remove();
    },

    _reloadSource: function(id) {
        this.sources[id].reload();
    },

    _updateSources: function(transform) {
        for (var id in this.sources) {
            this.sources[id].update(transform);
        }
    },

    _redoPlacement: function() {
        for (var id in this.sources) {
            if (this.sources[id].redoPlacement) this.sources[id].redoPlacement();
        }
    },

    _forwardSourceEvent: function(e) {
        this.fire('source.' + e.type, util.extend({source: e.target}, e));
    },

    _forwardTileEvent: function(e) {
        this.fire(e.type, util.extend({source: e.target}, e));
    },

    _forwardLayerEvent: function(e) {
        this.fire('layer.' + e.type, util.extend({layer: {id: e.target.id}}, e));
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

    'get icons': function(params, callback) {
        var sprite = this.sprite;
        var spriteAtlas = this.spriteAtlas;
        if (sprite.loaded()) {
            spriteAtlas.setSprite(sprite);
            spriteAtlas.addIcons(params.icons, callback);
        } else {
            sprite.on('load', function() {
                spriteAtlas.setSprite(sprite);
                spriteAtlas.addIcons(params.icons, callback);
            });
        }
    },

    'get glyphs': function(params, callback) {
        var stacks = params.stacks,
            remaining = Object.keys(stacks).length,
            allGlyphs = {};

        for (var fontName in stacks) {
            this.glyphSource.getSimpleGlyphs(fontName, stacks[fontName], params.uid, done);
        }

        function done(err, glyphs, fontName) {
            if (err) console.error(err);

            allGlyphs[fontName] = glyphs;
            remaining--;

            if (remaining === 0)
                callback(null, allGlyphs);
        }
    }
});
