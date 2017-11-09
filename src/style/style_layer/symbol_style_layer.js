// @flow

const StyleLayer = require('../style_layer');
const SymbolBucket = require('../../data/bucket/symbol_bucket');
const resolveTokens = require('../../util/token');
const {isExpression} = require('../../style-spec/expression');
const assert = require('assert');

import type {Feature, GlobalProperties} from '../../style-spec/expression';
import type {BucketParameters} from '../../data/bucket';

class SymbolStyleLayer extends StyleLayer {

    getLayoutValue(name: string, globals: GlobalProperties, feature?: Feature): any {
        const value = super.getLayoutValue(name, globals, feature);
        if (value !== 'auto') {
            return value;
        }

        switch (name) {
        case 'text-rotation-alignment':
        case 'icon-rotation-alignment':
            return this.getLayoutValue('symbol-placement', globals, feature) === 'line' ? 'map' : 'viewport';
        case 'text-pitch-alignment':
            return this.getLayoutValue('text-rotation-alignment', globals, feature);
        case 'icon-pitch-alignment':
            return this.getLayoutValue('icon-rotation-alignment', globals, feature);
        default:
            return value;
        }
    }

    getLayoutDeclaration(name: string) {
        return this._layoutDeclarations[name];
    }

    isLayoutValueFeatureConstant(name: string) {
        const declaration = this._layoutDeclarations[name];
        return !declaration || declaration.isFeatureConstant();
    }

    isLayoutValueZoomConstant(name: string) {
        const declaration = this._layoutDeclarations[name];
        return !declaration || declaration.isZoomConstant();
    }

    getValueAndResolveTokens(name: 'text-field' | 'icon-image', globals: GlobalProperties, feature: Feature) {
        const value = this.getLayoutValue(name, globals, feature);
        const declaration = this._layoutDeclarations[name];
        if (this.isLayoutValueFeatureConstant(name) && !isExpression(declaration.value)) {
            return resolveTokens(feature.properties, value);
        }

        return value;
    }

    createBucket(parameters: BucketParameters) {
        // Eventually we need to make SymbolBucket conform to the Bucket interface.
        // Hack around it with casts for now.
        return (new SymbolBucket((parameters: any)): any);
    }

    isOpacityZero(zoom: number, property: string) {
        return this.isPaintValueFeatureConstant(property) &&
            this.getPaintValue(property, { zoom: zoom }) === 0;
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
