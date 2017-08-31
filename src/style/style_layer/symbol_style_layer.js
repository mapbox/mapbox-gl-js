// @flow

const StyleLayer = require('../style_layer');
const SymbolBucket = require('../../data/bucket/symbol_bucket');
const assert = require('assert');

import type {Feature} from '../../style-spec/function';
import type {GlobalProperties} from '../style_layer';
import type {BucketParameters} from '../../data/bucket';

class SymbolStyleLayer extends StyleLayer {

    getLayoutValue(name: string, globalProperties?: GlobalProperties, feature?: Feature) {
        const value = super.getLayoutValue(name, globalProperties, feature);
        if (value !== 'auto') {
            return value;
        }

        switch (name) {
        case 'text-rotation-alignment':
        case 'icon-rotation-alignment':
            return this.getLayoutValue('symbol-placement', globalProperties, feature) === 'line' ? 'map' : 'viewport';
        case 'text-pitch-alignment':
            return this.getLayoutValue('text-rotation-alignment', globalProperties, feature);
        case 'icon-pitch-alignment':
            return this.getLayoutValue('icon-rotation-alignment', globalProperties, feature);
        default:
            return value;
        }
    }

    createBucket(parameters: BucketParameters) {
        // Eventually we need to make SymbolBucket conform to the Bucket interface.
        // Hack around it with casts for now.
        return (new SymbolBucket((parameters: any)): any);
    }

    queryRadius(): number {
        return 0;
    }

    queryIntersectsFeature(): boolean {
        assert(false); // Should take a different path in FeatureIndex
        return false;
    }
}

module.exports = SymbolStyleLayer;
