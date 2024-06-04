// @flow

import StyleLayer from '../style_layer.js';

import ClipBucket from '../../data/bucket/clip_bucket.js';
import properties from './clip_style_layer_properties.js';
import {Layout, PossiblyEvaluated} from '../properties.js';

import type {BucketParameters} from '../../data/bucket.js';
import type {LayoutProps, PaintProps} from './clip_style_layer_properties.js';
import type EvaluationParameters from '../evaluation_parameters.js';
import type {LayerSpecification} from '../../style-spec/types.js';
import type {ConfigOptions} from '../properties.js';

class ClipStyleLayer extends StyleLayer {
    _unevaluatedLayout: Layout<LayoutProps>;
    layout: PossiblyEvaluated<LayoutProps>;
    paint: PossiblyEvaluated<PaintProps>;

    constructor(layer: LayerSpecification, scope: string, options?: ?ConfigOptions) {
        super(layer, properties, scope, options);
    }

    recalculate(parameters: EvaluationParameters, availableImages: Array<string>) {
        super.recalculate(parameters, availableImages);
    }

    createBucket(parameters: BucketParameters<ClipStyleLayer>): ClipBucket {
        return new ClipBucket(parameters);
    }

    isTileClipped(): boolean {
        return true;
    }

    is3D(): boolean {
        return true;
    }
}

export default ClipStyleLayer;
