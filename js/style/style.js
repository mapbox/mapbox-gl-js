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
var validate = require('mapbox-gl-style-spec/lib/validate/latest');

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
        '_redoPlacement'
    ], this);

    var loaded = function(err, stylesheet) {
        if (err) {
            this.fire('error', {error: err});
            return;
        }

        var valid = validate(stylesheet);
        if (valid.length) {
            for (var i = 0; i < valid.length; i++) {
                this.fire('error', { error: new Error(valid[i].message) });
            }
            return;
        }

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

        if (!layer['source-layer']) return;
        if (!source) return;
        if (!source.vectorLayerIds) return;

        if (source.vectorLayerIds.indexOf(layer['source-layer']) === -1) {
            this.fire('error', {
                error: new Error(
                    'Source layer "' + layer['source-layer'] + '" ' +
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
        var id, layer;

        this._layers = {};
        this._order  = [];

        for (var i = 0; i < this.stylesheet.layers.length; i++) {
            layer = new StyleLayer(this.stylesheet.layers[i]);
            this._layers[layer.id] = layer;
            this._order.push(layer.id);
        }

        // Resolve layout properties.
        for (id in this._layers) {
            this._layers[id].resolveLayout();
        }

        // Resolve reference and paint properties.
        for (id in this._layers) {
            this._layers[id].resolveReference(this._layers);
            this._layers[id].resolvePaint();
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

    _broadcastLayers: function() {
        this.dispatcher.broadcast('set layers', this._order.map(function(id) {
            return this._layers[id].json();
        }, this));
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
        for (var id in this.sources)
            this.sources[id].used = false;

        this._updateZoomHistory(z);

        this.rasterFadeDuration = 300;
        for (id in this._layers) {
            var layer = this._layers[id];

            if (layer.recalculate(z, this.zoomHistory) && layer.source) {
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

    featuresAt: function(coord, params, callback) {
        this._queryFeatures('featuresAt', coord, params, callback);
    },

    featuresIn: function(bbox, params, callback) {
        this._queryFeatures('featuresIn', bbox, params, callback);
    },

    _queryFeatures: function(queryType, bboxOrCoords, params, callback) {
        var features = [];
        var error = null;

        if (params.layer) {
            params.layerIds = Array.isArray(params.layer) ? params.layer : [params.layer];
        }

        util.asyncAll(Object.keys(this.sources), function(id, callback) {
            var source = this.sources[id];
            source[queryType](bboxOrCoords, params, function(err, result) {
                if (result) features = features.concat(result);
                if (err) error = err;
                callback();
            });
        }.bind(this), function() {
            if (error) return callback(error);

            callback(null, features
                .filter(function(feature) {
                    return this._layers[feature.layer] !== undefined;
                }.bind(this))
                .map(function(feature) {
                    feature.layer = this._layers[feature.layer].json();
                    return feature;
                }.bind(this)));
        }.bind(this));
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
