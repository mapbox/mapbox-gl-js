// @flow

const StyleLayer = require('../style_layer');
const SymbolBucket = require('../../data/bucket/symbol_bucket');
const assert = require('assert');
const properties = require('./symbol_style_layer_properties');

const {
    Transitionable,
    Transitioning,
    Layout,
    PossiblyEvaluated
} = require('../properties');

import type {BucketParameters} from '../../data/bucket';
import type {LayoutProps, PaintProps} from './symbol_style_layer_properties';
import type EvaluationParameters from '../evaluation_parameters';

class SymbolStyleLayer extends StyleLayer {
    _unevaluatedLayout: Layout<LayoutProps>;
    layout: PossiblyEvaluated<LayoutProps>;

    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;

    constructor(layer: LayerSpecification) {
        super(layer, properties);
    }

    recalculate(parameters: EvaluationParameters) {
        super.recalculate(parameters);

        if (this.layout.get('icon-rotation-alignment') === 'auto') {
            if (this.layout.get('symbol-placement') === 'line') {
                this.layout._values['icon-rotation-alignment'] = 'map';
            } else {
                this.layout._values['icon-rotation-alignment'] = 'viewport';
            }
        }

        if (this.layout.get('text-rotation-alignment') === 'auto') {
            if (this.layout.get('symbol-placement') === 'line') {
                this.layout._values['text-rotation-alignment'] = 'map';
            } else {
                this.layout._values['text-rotation-alignment'] = 'viewport';
            }
        }

        // If unspecified, `*-pitch-alignment` inherits `*-rotation-alignment`
        if (this.layout.get('text-pitch-alignment') === 'auto') {
            this.layout._values['text-pitch-alignment'] = this.layout.get('text-rotation-alignment');
        }
        if (this.layout.get('icon-pitch-alignment') === 'auto') {
            this.layout._values['icon-pitch-alignment'] = this.layout.get('icon-rotation-alignment');
        }
    }

    createBucket(parameters: BucketParameters<*>) {
        return new SymbolBucket(parameters);
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
