// @flow

const StyleLayer = require('../style_layer');
const SymbolBucket = require('../../data/bucket/symbol_bucket');

import type {GlobalProperties, FeatureProperties} from '../style_layer';
import type {BucketParameters} from '../../data/bucket';

class SymbolStyleLayer extends StyleLayer {

    getLayoutValue(name: string, globalProperties?: GlobalProperties, featureProperties?: FeatureProperties) {
        const value = super.getLayoutValue(name, globalProperties, featureProperties);
        if (value !== 'auto') {
            return value;
        }

        switch (name) {
        case 'text-rotation-alignment':
        case 'icon-rotation-alignment':
            return this.getLayoutValue('symbol-placement', globalProperties, featureProperties) === 'line' ? 'map' : 'viewport';
        case 'text-pitch-alignment':
            return this.getLayoutValue('text-rotation-alignment', globalProperties, featureProperties);
        case 'icon-pitch-alignment':
            return this.getLayoutValue('icon-rotation-alignment', globalProperties, featureProperties);
        default:
            return value;
        }
    }

    createBucket(parameters: BucketParameters) {
        // Eventually we need to make SymbolBucket conform to the Bucket interface.
        // Hack around it with casts for now.
        return (new SymbolBucket((parameters : any)) : any);
    }
}

module.exports = SymbolStyleLayer;
