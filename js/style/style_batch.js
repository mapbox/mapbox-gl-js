'use strict';

var Source = require('../source/source');
var StyleLayer = require('./style_layer');

function styleBatch(style, work) {
    if (!style._loaded) {
        throw new Error('Style is not done loading');
    }

    var batch = Object.create(styleBatch.prototype);

    batch._style = style;
    batch._defer = {
        groupLayers: false,
        broadcastLayers: false,
        sources: {},
        events: [],
        change: false
    };

    work(batch);

    // call once if called
    if (batch._defer.groupLayers) batch._style._groupLayers();
    if (batch._defer.broadcastLayers) batch._style._broadcastLayers();

    // reload sources
    Object.keys(batch._defer.sources).forEach(function(sourceId) {
        batch._style._reloadSource(sourceId);
    });

    // re-fire events
    batch._defer.events.forEach(function(args) {
        batch._style.fire.apply(batch._style, args);
    });
    if (batch._defer.change) {
        batch._style.fire('change');
    }
}

styleBatch.prototype = {

    addLayer: function(layer, before) {
        if (this._style._layers[layer.id] !== undefined) {
            throw new Error('There is already a layer with this ID');
        }
        if (!(layer instanceof StyleLayer)) {
            layer = new StyleLayer(layer, this._style.stylesheet.constants || {});
        }
        this._style._layers[layer.id] = layer;
        this._style._order.splice(before ? this._style._order.indexOf(before) : Infinity, 0, layer.id);
        layer.resolveLayout();
        layer.resolveReference(this._style._layers);
        layer.resolvePaint();
        this._groupLayers();
        this._broadcastLayers();
        if (layer.source) {
            this._reloadSource(layer.source);
        }
        this.fire('layer.add', {layer: layer});

        return this;
    },

    removeLayer: function(id) {
        var layer = this._style._layers[id];
        if (layer === undefined) {
            throw new Error('There is no layer with this ID');
        }
        for (var i in this._style._layers) {
            if (this._style._layers[i].ref === id) {
                this.removeLayer(i);
            }
        }
        delete this._style._layers[id];
        this._style._order.splice(this._style._order.indexOf(id), 1);
        this._groupLayers();
        this._broadcastLayers();
        this.fire('layer.remove', {layer: layer});

        return this;
    },

    setPaintProperty: function(layer, name, value, klass) {
        this._style.getLayer(layer).setPaintProperty(name, value, klass);
        this.fire('change');

        return this;
    },

    setLayoutProperty: function(layer, name, value) {
        layer = this._style.getReferentLayer(layer);
        layer.setLayoutProperty(name, value);
        this._broadcastLayers();
        if (layer.source) {
            this._reloadSource(layer.source);
        }
        this.fire('change');

        return this;
    },

    setFilter: function(layer, filter) {
        layer = this._style.getReferentLayer(layer);
        layer.filter = filter;
        this._broadcastLayers();
        this._reloadSource(layer.source);
        this.fire('change');

        return this;
    },

    addSource: function(id, source) {
        if (!this._style._loaded) {
            throw new Error('Style is not done loading');
        }
        if (this._style.sources[id] !== undefined) {
            throw new Error('There is already a source with this ID');
        }
        source = Source.create(source);
        this._style.sources[id] = source;
        source.id = id;
        source.style = this._style;
        source.dispatcher = this._style.dispatcher;
        source.glyphAtlas = this._style.glyphAtlas;
        source
            .on('load', this._style._forwardSourceEvent)
            .on('error', this._style._forwardSourceEvent)
            .on('change', this._style._forwardSourceEvent)
            .on('tile.add', this._style._forwardTileEvent)
            .on('tile.load', this._style._forwardTileEvent)
            .on('tile.error', this._style._forwardTileEvent)
            .on('tile.remove', this._style._forwardTileEvent);
        this.fire('source.add', {source: source});

        return this;
    },

    removeSource: function(id) {
        if (this._style.sources[id] === undefined) {
            throw new Error('There is no source with this ID');
        }
        var source = this._style.sources[id];
        delete this._style.sources[id];
        source
            .off('load', this._style._forwardSourceEvent)
            .off('error', this._style._forwardSourceEvent)
            .off('change', this._style._forwardSourceEvent)
            .off('tile.add', this._style._forwardTileEvent)
            .off('tile.load', this._style._forwardTileEvent)
            .off('tile.error', this._style._forwardTileEvent)
            .off('tile.remove', this._style._forwardTileEvent);
        this.fire('source.remove', {source: source});

        return this;
    },

    _groupLayers: function() {
        this._defer.groupLayers = true;
    },
    _broadcastLayers: function() {
        this._defer.broadcastLayers = true;
    },
    _reloadSource: function(sourceId) {
        this._defer.sources[sourceId] = true;
    },
    fire: function(type) {
        if (type === 'change') {
            this._defer.change = true;
        } else {
            this._defer.events.push(arguments);
        }
    }

};

module.exports = styleBatch;
