'use strict';

const StyleLayer = require('./style_layer');
const util = require('../util/util');
const featureFilter = require('feature-filter');
const stringify = require('fast-stable-stringify');

function groupByLayout(layers) {
    const groups = {};

    for (const layer of layers) {
        const key = stringify([layer.type, layer.source, layer['source-layer'], layer.minzoom, layer.maxzoom, layer.filter, layer.layout]);
        let group = groups[key];
        if (!group) {
            group = groups[key] = [];
        }
        group.push(layer);
    }

    return util.values(groups);
}

class StyleLayerIndex {
    constructor(layers) {
        if (layers) {
            this.replace(layers);
        }
    }

    replace(layers) {
        this.order = layers.map((layer) => layer.id);
        this._layers = {};
        this.update(layers);
    }

    update(layers) {
        for (const layer of layers) {
            this._layers[layer.id] = layer;
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
