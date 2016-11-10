'use strict';

const StyleLayer = require('./style_layer');
const util = require('../util/util');
const featureFilter = require('feature-filter');
const groupByLayout = require('mapbox-gl-style-spec/lib/group_by_layout');

class StyleLayerIndex {
    constructor(layers) {
        if (layers) {
            this.replace(layers);
        }
    }

    replace(layers) {
        this.symbolOrder = [];
        for (const layer of layers) {
            if (layer.type === 'symbol') {
                this.symbolOrder.push(layer.id);
            }
        }
        this._layers = {};
        this.update(layers, []);
    }

    update(layers, removedIds, symbolOrder) {
        for (const layer of layers) {
            this._layers[layer.id] = layer;
        }
        for (const id of removedIds) {
            delete this._layers[id];
        }
        if (symbolOrder) {
            this.symbolOrder = symbolOrder;
        }

        this.familiesBySource = {};

        const groups = groupByLayout(util.values(this._layers));
        for (let layers of groups) {
            layers = layers.map((layer) => {
                layer = StyleLayer.create(layer);
                layer.updatePaintTransitions({}, {transition: false});
                layer.filter = featureFilter(layer.filter);
                return layer;
            });

            const layer = layers[0];
            if (layer.layout && layer.layout.visibility === 'none') {
                continue;
            }

            const sourceId = layer.source || '';
            let sourceGroup = this.familiesBySource[sourceId];
            if (!sourceGroup) {
                sourceGroup = this.familiesBySource[sourceId] = {};
            }

            const sourceLayerId = layer.sourceLayer || '_geojsonTileLayer';
            let sourceLayerFamilies = sourceGroup[sourceLayerId];
            if (!sourceLayerFamilies) {
                sourceLayerFamilies = sourceGroup[sourceLayerId] = [];
            }

            sourceLayerFamilies.push(layers);
        }
    }
}

module.exports = StyleLayerIndex;
