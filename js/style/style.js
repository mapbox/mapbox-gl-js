'use strict';

var Evented = require('../util/evented');
var Source = require('../source/source');
var StyleLayer = require('./style_layer');
var ImageSprite = require('./image_sprite');
var GlyphSource = require('../symbol/glyph_source');
var GlyphAtlas = require('../symbol/glyph_atlas');
var SpriteAtlas = require('../symbol/sprite_atlas');
var LineAtlas = require('../render/line_atlas');
var util = require('../util/util');
var ajax = require('../util/ajax');
var normalizeURL = require('../util/mapbox').normalizeStyleURL;
var browser = require('../util/browser');
var Dispatcher = require('../util/dispatcher');
var Point = require('point-geometry');
var AnimationLoop = require('./animation_loop');

module.exports = Style;

function Style(stylesheet, animationLoop) {
    this.animationLoop = animationLoop || new AnimationLoop();
    this.dispatcher = new Dispatcher(Math.max(browser.hardwareConcurrency - 1, 1), this);
    this.glyphAtlas = new GlyphAtlas(1024, 1024);
    this.spriteAtlas = new SpriteAtlas(512, 512);
    this.spriteAtlas.resize(browser.devicePixelRatio);
    this.lineAtlas = new LineAtlas(256, 512);

    this._layers = {};
    this._order  = [];
    this._groups = [];
    this.sources = {};

    this.zoomHistory = {};

    util.bindAll([
        '_forwardSourceEvent',
        '_forwardTileEvent'
    ], this);

    var loaded = function(err, stylesheet) {
        if (err) {
            this.fire('error', {error: err});
            return;
        }

        this._loaded = true;
        this.stylesheet = stylesheet;

        if (stylesheet.version !== 7) console.warn('Stylesheet version must be 7');
        if (!Array.isArray(stylesheet.layers)) console.warn('Stylesheet must have layers');

        var sources = stylesheet.sources;
        for (var id in sources) {
            this.addSource(id, sources[id]);
        }

        if (stylesheet.sprite) {
            this.sprite = new ImageSprite(stylesheet.sprite);
            this.sprite.on('load', this.fire.bind(this, 'change'));
        }

        this.glyphSource = new GlyphSource(stylesheet.glyphs, this.glyphAtlas);
        this._resolve();
        this.fire('load');
    }.bind(this);

    if (typeof stylesheet === 'string') {
        ajax.getJSON(normalizeURL(stylesheet), loaded);
    } else {
        browser.frame(loaded.bind(this, null, stylesheet));
    }
}

Style.prototype = util.inherit(Evented, {
    _loaded: false,

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
            layer = new StyleLayer(this.stylesheet.layers[i], this.stylesheet.constants || {});
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
        var ordered = [];

        for (var id in this._layers) {
            ordered.push(this._layers[id].json());
        }

        this.dispatcher.broadcast('set layers', ordered);
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

    addSource: function(id, source) {
        if (this.sources[id] !== undefined) {
            throw new Error('There is already a source with this ID');
        }
        source = Source.create(source);
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

    removeSource: function(id) {
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

    getSource: function(id) {
        return this.sources[id];
    },

    addLayer: function(layer, before) {
        if (this._layers[layer.id] !== undefined) {
            throw new Error('There is already a layer with this ID');
        }
        layer = new StyleLayer(layer, this.stylesheet.constants || {});
        this._layers[layer.id] = layer;
        this._order.splice(before ? this._order.indexOf(before) : Infinity, 0, layer.id);
        layer.resolveLayout();
        layer.resolveReference(this._layers);
        layer.resolvePaint();
        this._groupLayers();
        this._broadcastLayers();
        this.fire('layer.add', {layer: layer});
        return this;
    },

    removeLayer: function(id) {
        var layer = this._layers[id];
        if (layer === undefined) {
            throw new Error('There is no layer with this ID');
        }
        for (var i in this._layers) {
            if (this._layers[i].ref === id) {
                this.removeLayer(i);
            }
        }
        delete this._layers[id];
        this._order.splice(this._order.indexOf(id), 1);
        this._groupLayers();
        this._broadcastLayers();
        this.fire('layer.remove', {layer: layer});
        return this;
    },

    getLayer: function(id) {
        return this._layers[id];
    },

    getReferentLayer: function(id) {
        var layer = this.getLayer(id);
        if (layer.ref) {
            layer = this.getLayer(layer.ref);
        }
        return layer;
    },

    setFilter: function(layer, filter) {
        layer = this.getReferentLayer(layer);
        layer.filter = filter;
        this._broadcastLayers();
        this.sources[layer.source].reload();
    },

    getFilter: function(layer) {
        return this.getReferentLayer(layer).filter;
    },

    setLayoutProperty: function(layer, name, value) {
        layer = this.getReferentLayer(layer);
        layer.setLayoutProperty(name, value);
        this._broadcastLayers();
        this.sources[layer.source].reload();
    },

    getLayoutProperty: function(layer, name) {
        return this.getReferentLayer(layer).getLayoutProperty(name);
    },

    setPaintProperty: function(layer, name, value, klass) {
        this.getLayer(layer).setPaintProperty(name, value, klass);
    },

    getPaintProperty: function(layer, name, klass) {
        return this.getLayer(layer).getPaintProperty(name, klass);
    },

    featuresAt: function(point, params, callback) {
        var features = [];
        var error = null;

        point = Point.convert(point);

        if (params.layer) {
            params.layer = { id: params.layer.id };
        }

        util.asyncEach(Object.keys(this.sources), function(id, callback) {
            var source = this.sources[id];
            source.featuresAt(point, params, function(err, result) {
                if (result) features = features.concat(result);
                if (err) error = err;
                callback();
            });
        }.bind(this), function() {
            if (error) return callback(error);

            features.forEach(function(feature) {
                feature.layer = this._layers[feature.layer].json();
            }.bind(this));

            callback(null, features);
        }.bind(this));
    },

    _remove: function() {
        this.dispatcher.remove();
    },

    _updateSources: function(transform) {
        for (var id in this.sources) {
            this.sources[id].update(transform);
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
        this.glyphSource.getRects(params.fontstack, params.codepoints, params.uid, callback);
    }
});
