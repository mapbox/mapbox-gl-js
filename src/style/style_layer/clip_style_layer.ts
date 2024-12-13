import StyleLayer from '../style_layer';
import ClipBucket from '../../data/bucket/clip_bucket';
import {getLayoutProperties, getPaintProperties} from './clip_style_layer_properties';

import type {Layout, PossiblyEvaluated, ConfigOptions} from '../properties';
import type {BucketParameters} from '../../data/bucket';
import type {LayoutProps, PaintProps} from './clip_style_layer_properties';
import type EvaluationParameters from '../evaluation_parameters';
import type {LayerSpecification} from '../../style-spec/types';
import type {LUT} from "../../util/lut";

class ClipStyleLayer extends StyleLayer {
    override _unevaluatedLayout: Layout<LayoutProps>;
    override layout: PossiblyEvaluated<LayoutProps>;
    override paint: PossiblyEvaluated<PaintProps>;

    constructor(layer: LayerSpecification, scope: string, lut: LUT | null, options?: ConfigOptions | null) {
        const properties = {
            layout: getLayoutProperties(),
            paint: getPaintProperties()
        };
        super(layer, properties, scope, lut, options);
    }

    override recalculate(parameters: EvaluationParameters, availableImages: Array<string>) {
        super.recalculate(parameters, availableImages);
    }

    createBucket(parameters: BucketParameters<ClipStyleLayer>): ClipBucket {
        return new ClipBucket(parameters);
    }

    override isTileClipped(): boolean {
        return true;
    }

    override is3D(): boolean {
        return true;
    }
}

export default ClipStyleLayer;
