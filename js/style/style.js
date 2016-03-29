'use strict';

var Evented = require('../util/evented');
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
var Source = require('../source/source');
var styleSpec = require('./style_spec');

module.exports = Style;

function Style(stylesheet, animationLoop) {
    this.animationLoop = animationLoop || new AnimationLoop();
    this.dispatcher = new Dispatcher(Math.max(1), this);
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

        this._resetMutations();
        this._mutations.change = true;
        this._mutations.cascade = true;

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

    _checkLoaded: function () {
        if (!this._loaded) {
            throw new Error('Style is not done loading');
        }
    },

    /**
     * Apply queued style mutations in a batch
     * @private
     */
    update: function(classes, options) {
        if (!this._mutations.change) return this;

        if (this._mutations.groupLayers) {
            this._groupLayers();
        }

        if (this._mutations.updateLayers) {
            this._broadcastLayers();
        } else {
            var updatedIds = Object.keys(this._mutations.layers);
            if (updatedIds.length) {
                this._broadcastLayers(updatedIds);
            }
        }

        var updatedSourceIds = Object.keys(this._mutations.sources);
        var i;
        for (i = 0; i < updatedSourceIds.length; i++) {
            this._reloadSource(updatedSourceIds[i]);
        }

        for (i = 0; i < this._mutations.events.length; i++) {
            var args = this._mutations.events[i];
            this.fire(args[0], args[1]);
        }

        if (this._mutations.cascade) {
            this._cascade(classes, options);

        } else if (this._mutations.change) {
            this.fire('change');
        }

        this._resetMutations();

        return this;
    },

    _resetMutations: function() {
        this._mutations = {
            events: [],
            layers: {},
            sources: {}
        };
    },

    addSource: function(id, source) {
        this._checkLoaded();
        if (this.sources[id] !== undefined) {
            throw new Error('There is already a source with this ID');
        }

        if (!Source.is(source)) {
            if (validateStyle.emitErrors(this, validateStyle.source({
                key: 'sources.' + id,
                style: this.serialize(),
                value: source,
                styleSpec: styleSpec
            }))) return this;
        }

        source = Source.create(source);
        this.sources[id] = source;
        source.id = id;
        source.style = this;
        source.dispatcher = this.dispatcher;
        source
            .on('load', this._forwardSourceEvent)
            .on('error', this._forwardSourceEvent)
            .on('change', this._forwardSourceEvent)
            .on('tile.add', this._forwardTileEvent)
            .on('tile.load', this._forwardTileEvent)
            .on('tile.error', this._forwardTileEvent)
            .on('tile.remove', this._forwardTileEvent)
            .on('tile.stats', this._forwardTileEvent);

        this._mutations.events.push(['source.add', {source: source}]);
        this._mutations.change = true;

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
        this._checkLoaded();

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
            .off('tile.remove', this._forwardTileEvent)
            .off('tile.stats', this._forwardTileEvent);

        this._mutations.events.push(['source.remove', {source: source}]);
        this._mutations.change = true;

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
        this._checkLoaded();

        if (!(layer instanceof StyleLayer)) {
            if (validateStyle.emitErrors(this, validateStyle.layer({
                key: 'layers.' + layer.id,
                value: layer,
                style: this.serialize(),
                styleSpec: styleSpec,
                // this layer is not in the style.layers array, so we pass an
                // impossible array index
                arrayIndex: -1
            }))) return this;

            var refLayer = layer.ref && this.getLayer(layer.ref);
            layer = StyleLayer.create(layer, refLayer);
        }
        this._validateLayer(layer);

        layer.on('error', this._forwardLayerEvent);

        this._layers[layer.id] = layer;
        this._order.splice(before ? this._order.indexOf(before) : Infinity, 0, layer.id);

        this._mutations.groupLayers = true;
        this._mutations.updateLayers = true;
        if (layer.source) {
            this._mutations.sources[layer.source] = true;
        }
        this._mutations.events.push(['layer.add', {layer: layer}]);
        this._mutations.change = true;
        this._mutations.cascade = true;

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
        this._checkLoaded();

        var layer = this._layers[id];
        if (layer === undefined) {
            throw new Error('There is no layer with this ID');
        }
        for (var i in this._layers) {
            if (this._layers[i].ref === id) {
                this.removeLayer(i);
            }
        }

        layer.off('error', this._forwardLayerEvent);

        delete this._layers[id];
        this._order.splice(this._order.indexOf(id), 1);

        this._mutations.groupLayers = true;
        this._mutations.updateLayers = true;
        this._mutations.events.push(['layer.remove', {layer: layer}]);
        this._mutations.change = true;
        this._mutations.cascade = true;

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

    setLayerZoomRange: function(layerId, minzoom, maxzoom) {
        this._checkLoaded();

        var layer = this.getReferentLayer(layerId);
        layerId = layer.id;

        if (layer.minzoom === minzoom && layer.maxzoom === maxzoom) return this;

        if (minzoom != null) {
            layer.minzoom = minzoom;
        }
        if (maxzoom != null) {
            layer.maxzoom = maxzoom;
        }

        this._mutations.layers[layerId] = true;
        if (layer.source) {
            this._mutations.sources[layer.source] = true;
        }
        this._mutations.change = true;

        return this;
    },

    setFilter: function(layerId, filter) {
        this._checkLoaded();

        var layer = this.getReferentLayer(layerId);
        layerId = layer.id;

        if (validateStyle.emitErrors(this, validateStyle.filter({
            key: 'layers.' + layerId + '.filter',
            value: filter,
            style: this.serialize(),
            styleSpec: styleSpec
        }))) return this;

        if (util.deepEqual(layer.filter, filter)) return this;
        layer.filter = filter;

        this._mutations.layers[layerId] = true;
        if (layer.source) {
            this._mutations.sources[layer.source] = true;
        }
        this._mutations.change = true;

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

    setLayoutProperty: function(layerId, name, value) {
        this._checkLoaded();

        var layer = this.getReferentLayer(layerId);
        layerId = layer.id;

        if (layer.getLayoutProperty(name) === value) return this;

        layer.setLayoutProperty(name, value);

        this._mutations.layers[layerId] = true;

        if (layer.source) {
            this._mutations.sources[layer.source] = true;
        }
        this._mutations.change = true;
        this._mutations.cascade = true;

        return this;
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

    setPaintProperty: function(layerId, name, value, klass) {
        this._checkLoaded();

        this.getLayer(layerId).setPaintProperty(name, value, klass);
        this._mutations.change = true;
        this._mutations.cascade = true;

        return this;
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

    queryRenderedFeatures: function(queryGeometry, params, classes, zoom, bearing) {
        var sourceResults = [];
        for (var id in this.sources) {
            var source = this.sources[id];
            if (source.queryRenderedFeatures) {
                sourceResults.push(source.queryRenderedFeatures(queryGeometry, params, classes, zoom, bearing));
            }
        }
        return this._flattenRenderedFeatures(sourceResults);
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
