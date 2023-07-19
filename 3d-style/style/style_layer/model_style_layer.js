// @flow

import StyleLayer from '../../../src/style/style_layer.js';
import ModelBucket from '../../data/bucket/model_bucket.js';
import type {LayerSpecification} from '../../../src/style-spec/types.js';
import properties from './model_style_layer_properties.js';
import type {PaintProps, LayoutProps} from './model_style_layer_properties.js';
import type {BucketParameters} from '../../../src/data/bucket.js';
import {Transitionable, Transitioning, PossiblyEvaluated, PropertyValue} from '../../../src/style/properties.js';
import type {Expression} from '../../../src/style-spec/expression/expression.js';

class ModelStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;
    layout: PossiblyEvaluated<LayoutProps>;

    constructor(layer: LayerSpecification, options?: ?Map<string, Expression>) {
        super(layer, properties, options);
    }

    createBucket(parameters: BucketParameters<ModelStyleLayer>): ModelBucket {
        return new ModelBucket(parameters);
    }

    getProgramIds(): Array<string> {
        return ['model'];
    }

    is3D(): boolean {
        return true;
    }

    hasShadowPass(): boolean {
        return true;
    }

    hasLightBeamPass(): boolean {
        return true;
    }

    // $FlowFixMe[method-unbinding]
    queryRadius(): number {
        return 0;
    }

    _handleOverridablePaintPropertyUpdate<T, R>(name: string, oldValue: PropertyValue<T, R>, newValue: PropertyValue<T, R>): boolean {
        if (!this.layout || oldValue.isDataDriven() || newValue.isDataDriven()) {
            return false;
        }
        // relayout on programatically setPaintProperty for all non-data-driven properties that get baked into vertex data.
        // Buckets could be updated without relayout later, if needed to optimize.
        return name === "model-color" || name === "model-color-mix-intensity" || name === "model-rotation" || name === "model-scale" || name === "model-translation" || name === "model-emissive-strength";
    }
}

export default ModelStyleLayer;
