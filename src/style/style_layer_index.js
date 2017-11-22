// @flow

const StyleLayer = require('./style_layer');
const util = require('../util/util');
const featureFilter = require('../style-spec/feature_filter');
const groupByLayout = require('../style-spec/group_by_layout');

export type LayerConfigs = { [string]: LayerSpecification };

class StyleLayerIndex {
    familiesBySource: { [string]: { [string]: Array<Array<StyleLayer>> } };

    _layerConfigs: LayerConfigs;
    _layers: { [string]: StyleLayer };

    constructor(layerConfigs: ?Array<LayerSpecification>) {
        if (layerConfigs) {
            this.replace(layerConfigs);
        }
    }

    replace(layerConfigs: Array<LayerSpecification>) {
        this._layerConfigs = {};
        this._layers = {};
        this.update(layerConfigs, []);
    }

    update(layerConfigs: Array<LayerSpecification>, removedIds: Array<string>) {
        for (const layerConfig of layerConfigs) {
            this._layerConfigs[layerConfig.id] = layerConfig;

            const layer = this._layers[layerConfig.id] = StyleLayer.create(layerConfig);
            layer._featureFilter = featureFilter(layer.filter);
        }
        for (const id of removedIds) {
            delete this._layerConfigs[id];
            delete this._layers[id];
        }

        this.familiesBySource = {};

        const groups = groupByLayout(util.values(this._layerConfigs));

        for (const layerConfigs of groups) {
            const layers = layerConfigs.map((layerConfig) => this._layers[layerConfig.id]);

            const layer = layers[0];
            if (layer.visibility === 'none') {
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
