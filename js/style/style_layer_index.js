'use strict';

const StyleLayer = require('./style_layer');
const util = require('../util/util');
const featureFilter = require('feature-filter');
const groupByLayout = require('mapbox-gl-style-spec/lib/group_by_layout');

class StyleLayerIndex {
    constructor(layerConfigs) {
        if (layerConfigs) {
            this.replace(layerConfigs);
        }
    }

    replace(layerConfigs) {
        this.symbolOrder = [];
        for (const layerConfig of layerConfigs) {
            if (layerConfig.type === 'symbol') {
                this.symbolOrder.push(layerConfig.id);
            }
        }
        this._layerConfigs = {};
        this.update(layerConfigs, []);
    }

    update(layerConfigs, removedIds, symbolOrder) {
        for (const layerConfig of layerConfigs) {
            this._layerConfigs[layerConfig.id] = layerConfig;
        }
        for (const id of removedIds) {
            delete this._layerConfigs[id];
        }
        if (symbolOrder) {
            this.symbolOrder = symbolOrder;
        }

        this.familiesBySource = {};

        const groups = groupByLayout(util.values(this._layerConfigs));

        for (const layerConfigs of groups) {
            const layers = layerConfigs.map((layer) => {
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
