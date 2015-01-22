'use strict';

var Evented = require('../util/evented');
var Source = require('../source/source');
var StyleLayer = require('./style_layer');
var ImageSprite = require('./image_sprite');
var GlyphSource = require('../symbol/glyph_source');
var GlyphAtlas = require('../symbol/glyph_atlas');
var SpriteAtlas = require('../symbol/sprite_atlas');
var util = require('../util/util');
var ajax = require('../util/ajax');
var normalizeURL = require('../util/mapbox').normalizeStyleURL;
var browser = require('../util/browser');
var Dispatcher = require('../util/dispatcher');
var Point = require('point-geometry');

module.exports = Style;

function Style(stylesheet, animationLoop) {
    this.animationLoop = animationLoop;
    this.dispatcher = new Dispatcher(Math.max(browser.hardwareConcurrency - 1, 1), this);
    this.glyphAtlas = new GlyphAtlas(1024, 1024);
    this.spriteAtlas = new SpriteAtlas(512, 512);
    this.spriteAtlas.resize(browser.devicePixelRatio);

    this._layers = {};
    this._groups = [];
    this.sources = {};

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
            this.addSource(id, Source.create(sources[id]));
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
        this._layers = {};
        this._groups = [];

        var processLayers = function(layers, nested) {
            for (var i = 0; i < layers.length; i++) {
                var layer = new StyleLayer(layers[i]);

                layer.nested = nested;

                this._layers[layer.id] = layer;

                if (layers[i].layers) {
                    processLayers(layers[i].layers, true);
                }
            }
        }.bind(this);

        processLayers(this.stylesheet.layers);

        var id, layer, group, ordered = [];

        // Resolve layout properties.
        for (id in this._layers) {
            this._layers[id].resolveLayout(this._layers,
                this.stylesheet.constants,
                this.stylesheet.transition);
        }

        // Resolve paint properties.
        for (id in this._layers) {
            this._layers[id].resolvePaint(this._layers,
                this.stylesheet.constants,
                this.stylesheet.transition);
        }

        // Split into groups of consecutive top-level layers with the same source.
        for (id in this._layers) {
            layer = this._layers[id];

            ordered.push(layer.json());

            if (layer.nested)
                continue;

            if (!group || layer.source !== group.source) {
                group = [];
                group.source = layer.source;
                this._groups.push(group);
            }

            group.push(layer);
        }

        this.dispatcher.broadcast('set layers', ordered);
    },

    _cascade: function(classes, options) {
        if (!this._loaded) return;

        options = options || {
            transition: true
        };

        for (var id in this._layers) {
            this._layers[id].cascade(classes, options, this.animationLoop);
        }

        this.fire('change');
    },

    _recalculate: function(z) {
        if (typeof z !== 'number') console.warn('recalculate expects zoom level');

        for (var id in this.sources)
            this.sources[id].used = false;

        this.rasterFadeDuration = 300;

        for (id in this._layers) {
            var layer = this._layers[id];

            if (layer.recalculate(z) && layer.source) {
                this.sources[layer.source].used = true;
            }
        }

        this.z = z;
        this.fire('zoom');
    },

    addSource: function(id, source) {
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

    getLayer: function(id) {
        return this._layers[id];
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
                feature.layers = feature.layers.map(function(id) {
                    return this._layers[id].json();
                }.bind(this));
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
        this.glyphSource.getRects(params.fontstack, params.codepoints, params.id, callback);
    }
});
