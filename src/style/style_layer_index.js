// @flow

import createStyleLayer from './create_style_layer.js';

import {values} from '../util/util.js';
import groupByLayout from '../style-spec/group_by_layout.js';

import type {TypedStyleLayer} from './style_layer/typed_style_layer.js';
import type {LayerSpecification} from '../style-spec/types.js';
import type {ConfigOptions} from './properties.js';

export type LayerConfigs = {[_: string]: LayerSpecification };
export type Family<Layer: TypedStyleLayer> = Array<Layer>;

class StyleLayerIndex {
    scope: string;
    familiesBySource: { [source: string]: { [sourceLayer: string]: Array<Family<TypedStyleLayer>> } };
    keyCache: { [source: string]: string };

    _layerConfigs: LayerConfigs;
    _layers: {[_: string]: TypedStyleLayer };
    _options: ?ConfigOptions;

    constructor(layerConfigs: ?Array<LayerSpecification>) {
        this.keyCache = {};
        this._layers = {};
        this._layerConfigs = {};
        if (layerConfigs) {
            this.replace(layerConfigs);
        }
    }

    replace(layerConfigs: Array<LayerSpecification>, options?: ?ConfigOptions) {
        this._layerConfigs = {};
        this._layers = {};
        this.update(layerConfigs, [], options);
    }

    update(layerConfigs: Array<LayerSpecification>, removedIds: Array<string>, options: ?ConfigOptions) {
        this._options = options;

        for (const layerConfig of layerConfigs) {
            this._layerConfigs[layerConfig.id] = layerConfig;

            const layer = this._layers[layerConfig.id] = ((createStyleLayer(layerConfig, this.scope, this._options): any): TypedStyleLayer);
            layer.compileFilter();
            if (this.keyCache[layerConfig.id])
                delete this.keyCache[layerConfig.id];
        }
        for (const id of removedIds) {
            delete this.keyCache[id];
            delete this._layerConfigs[id];
            delete this._layers[id];
        }

        this.familiesBySource = {};

        const groups = groupByLayout(values(this._layerConfigs), this.keyCache);

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

export default StyleLayerIndex;
