'use strict';

var Source = require('../source/source');
var StyleLayer = require('./style_layer');

function styleBatch(style, work) {
    if (!style._loaded) {
        throw new Error('Style is not done loading');
    }

    var batch = Object.create(styleBatch.prototype);

    batch._style = style;
    batch._groupLayers = false;
    batch._broadcastLayers = false;
    batch._reloadSources = {};
    batch._events = [];
    batch._change = false;

    work(batch);

    if (batch._groupLayers) {
        batch._style._groupLayers();
    }

    if (batch._broadcastLayers) {
        batch._style._broadcastLayers();
    }

    Object.keys(batch._reloadSources).forEach(function(sourceId) {
        batch._style._reloadSource(sourceId);
    });

    batch._events.forEach(function(args) {
        batch._style.fire.apply(batch._style, args);
    });

    if (batch._change) {
        batch._style.fire('change');
    }
}

styleBatch.prototype = {

    addLayer: function(layer, before) {
        if (this._style._layers[layer.id] !== undefined) {
            throw new Error('There is already a layer with this ID');
        }
        if (!(layer instanceof StyleLayer)) {
            layer = new StyleLayer(layer);
        }
        this._style._validateLayer(layer);
        this._style._layers[layer.id] = layer;
        this._style._order.splice(before ? this._style._order.indexOf(before) : Infinity, 0, layer.id);
        layer.resolveLayout();
        layer.resolveReference(this._style._layers);
        layer.resolvePaint();

        this._groupLayers = true;
        this._broadcastLayers = true;
        if (layer.source) {
            this._reloadSources[layer.source] = true;
        }
        this._events.push(['layer.add', {layer: layer}]);
        this._change = true;

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

        this._groupLayers = true;
        this._broadcastLayers = true;
        this._events.push(['layer.remove', {layer: layer}]);
        this._change = true;

        return this;
    },

    setPaintProperty: function(layer, name, value, klass) {
        this._style.getLayer(layer).setPaintProperty(name, value, klass);
        this._change = true;

        return this;
    },

    setLayoutProperty: function(layer, name, value) {
        layer = this._style.getReferentLayer(layer);
        layer.setLayoutProperty(name, value);

        this._broadcastLayers = true;
        if (layer.source) {
            this._reloadSources[layer.source] = true;
        }
        this._change = true;

        return this;
    },

    setFilter: function(layer, filter) {
        layer = this._style.getReferentLayer(layer);
        layer.filter = filter;

        this._broadcastLayers = true;
        if (layer.source) {
            this._reloadSources[layer.source] = true;
        }
        this._change = true;

        return this;
    },

    setLayerZoomRange: function(layerId, minzoom, maxzoom) {
        var layer = this._style.getReferentLayer(layerId);
        if (minzoom != null) {
            layer.minzoom = minzoom;
        }
        if (maxzoom != null) {
            layer.maxzoom = maxzoom;
        }

        this._broadcastLayers = true;
        if (layer.source) {
            this._reloadSources[layer.source] = true;
        }
        this._change = true;

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
        source
            .on('load', this._style._forwardSourceEvent)
            .on('error', this._style._forwardSourceEvent)
            .on('change', this._style._forwardSourceEvent)
            .on('tile.add', this._style._forwardTileEvent)
            .on('tile.load', this._style._forwardTileEvent)
            .on('tile.error', this._style._forwardTileEvent)
            .on('tile.remove', this._style._forwardTileEvent)
            .on('tile.stats', this._style._forwardTileEvent);

        this._events.push(['source.add', {source: source}]);
        this._change = true;

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
            .off('tile.remove', this._style._forwardTileEvent)
            .off('tile.stats', this._style._forwardTileEvent);

        this._events.push(['source.remove', {source: source}]);
        this._change = true;

        return this;
    }
};

module.exports = styleBatch;
