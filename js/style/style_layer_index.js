'use strict';

const StyleLayer = require('./style_layer');
const featureFilter = require('feature-filter');

class StyleLayerIndex {
    constructor(layers) {
        this.families = [];
        if (layers) {
            this.replace(layers);
        }
    }

    replace(layers) {
        this.layers = {};
        this.order = [];
        this.update(layers);
    }

    _updateLayer(layer) {
        const refLayer = layer.ref && this.layers[layer.ref];

        let styleLayer = this.layers[layer.id];
        if (styleLayer) {
            styleLayer.set(layer, refLayer);
        } else {
            styleLayer = this.layers[layer.id] = StyleLayer.create(layer, refLayer);
        }

        styleLayer.updatePaintTransitions({}, {transition: false});
        styleLayer.filter = featureFilter(styleLayer.filter);
    }

    update(layers) {
        for (const layer of layers) {
            if (!this.layers[layer.id]) {
                this.order.push(layer.id);
            }
        }

        // Update ref parents
        for (const layer of layers) {
            if (!layer.ref) this._updateLayer(layer);
        }

        // Update ref children
        for (const layer of layers) {
            if (layer.ref) this._updateLayer(layer);
        }

        this.families = [];
        const byParent = {};

        for (const id of this.order) {
            const layer = this.layers[id];
            const parent = layer.ref ? this.layers[layer.ref] : layer;

            if (parent.layout && parent.layout.visibility === 'none') {
                continue;
            }

            let family = byParent[parent.id];
            if (!family) {
                family = [];
                this.families.push(family);
                byParent[parent.id] = family;
            }

            if (layer.ref) {
                family.push(layer);
            } else {
                family.unshift(layer);
            }
        }

        this.familiesBySource = {};

        for (const family of this.families) {
            const layer = family[0];

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

            sourceLayerFamilies.push(family);
        }
    }
}

module.exports = StyleLayerIndex;
