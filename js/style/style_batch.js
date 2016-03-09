'use strict';

var Source = require('../source/source');
var StyleLayer = require('./style_layer');
var validateStyle = require('./validate_style');
var styleSpec = require('./style_spec');
var util = require('../util/util');

function styleBatch(style, work) {
    if (!style._loaded) {
        throw new Error('Style is not done loading');
    }

    var batch = Object.create(styleBatch.prototype);

    batch._style = style;
    batch._groupLayers = false;
    batch._updateAllLayers = false;
    batch._updatedLayers = {};
    batch._updatedSources = {};
    batch._events = [];
    batch._change = false;

    work(batch);

    if (batch._groupLayers) {
        batch._style._groupLayers();
    }

    if (batch._updateAllLayers) {
        batch._style._broadcastLayers();

    } else {
        var updatedIds = Object.keys(batch._updatedLayers);
        if (updatedIds.length) {
            batch._style._broadcastLayers(updatedIds);
        }
    }

    Object.keys(batch._updatedSources).forEach(function(sourceId) {
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
        if (!(layer instanceof StyleLayer)) {
            if (validateStyle.emitErrors(this._style, validateStyle.layer({
                key: 'layers.' + layer.id,
                value: layer,
                style: this._style.serialize(),
                styleSpec: styleSpec,
                // this layer is not in the style.layers array, so we pass an
                // impossible array index
                arrayIndex: -1
            }))) return this;

            var refLayer = layer.ref && this._style.getLayer(layer.ref);
            layer = StyleLayer.create(layer, refLayer);
        }
        this._style._validateLayer(layer);

        layer.on('error', this._style._forwardLayerEvent);

        this._style._layers[layer.id] = layer;
        this._style._order.splice(before ? this._style._order.indexOf(before) : Infinity, 0, layer.id);

        this._groupLayers = true;
        this._updateAllLayers = true;
        if (layer.source) {
            this._updatedSources[layer.source] = true;
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

        layer.off('error', this._style._forwardLayerEvent);

        delete this._style._layers[id];
        this._style._order.splice(this._style._order.indexOf(id), 1);

        this._groupLayers = true;
        this._updateAllLayers = true;
        this._events.push(['layer.remove', {layer: layer}]);
        this._change = true;

        return this;
    },

    setPaintProperty: function(layerId, name, value, klass) {
        this._style.getLayer(layerId).setPaintProperty(name, value, klass);
        this._change = true;

        return this;
    },

    setLayoutProperty: function(layerId, name, value) {
        var layer = this._style.getReferentLayer(layerId);
        layerId = layer.id;

        if (layer.getLayoutProperty(name) === value) return this;

        layer.setLayoutProperty(name, value);

        this._updatedLayers[layerId] = true;

        if (layer.source) {
            this._updatedSources[layer.source] = true;
        }
        this._change = true;

        return this;
    },

    setFilter: function(layerId, filter) {
        var layer = this._style.getReferentLayer(layerId);
        layerId = layer.id;

        if (validateStyle.emitErrors(this._style, validateStyle.filter({
            key: 'layers.' + layerId + '.filter',
            value: filter,
            style: this._style.serialize(),
            styleSpec: styleSpec
        }))) return this;

        if (util.deepEqual(layer.filter, filter)) return this;
        layer.filter = filter;

        this._updatedLayers[layerId] = true;
        if (layer.source) {
            this._updatedSources[layer.source] = true;
        }
        this._change = true;

        return this;
    },

    setLayerZoomRange: function(layerId, minzoom, maxzoom) {
        var layer = this._style.getReferentLayer(layerId);
        layerId = layer.id;

        if (layer.minzoom === minzoom && layer.maxzoom === maxzoom) return this;

        if (minzoom != null) {
            layer.minzoom = minzoom;
        }
        if (maxzoom != null) {
            layer.maxzoom = maxzoom;
        }

        this._updatedLayers[layerId] = true;
        if (layer.source) {
            this._updatedSources[layer.source] = true;
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

        if (!Source.is(source)) {
            if (validateStyle.emitErrors(this._style, validateStyle.source({
                key: 'sources.' + id,
                style: this._style.serialize(),
                value: source,
                styleSpec: styleSpec
            }))) return this;
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
