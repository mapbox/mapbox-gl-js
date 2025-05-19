import StyleLayer from '../../../src/style/style_layer';
import BuildingBucket from '../../data/bucket/building_bucket';
import {getLayoutProperties, getPaintProperties} from './building_style_layer_properties';

import type {Transitionable, Transitioning, PossiblyEvaluated, ConfigOptions} from '../../../src/style/properties';
import type {BucketParameters} from '../../../src/data/bucket';
import type {PaintProps, LayoutProps} from './building_style_layer_properties';
import type {LayerSpecification} from '../../../src/style-spec/types';
import type {LUT} from "../../../src/util/lut";

class BuildingStyleLayer extends StyleLayer {
    override type: 'building';

    override _transitionablePaint: Transitionable<PaintProps>;
    override _transitioningPaint: Transitioning<PaintProps>;
    override paint: PossiblyEvaluated<PaintProps>;
    override layout: PossiblyEvaluated<LayoutProps>;

    constructor(layer: LayerSpecification, scope: string, lut: LUT | null, options?: ConfigOptions | null) {
        const properties = {
            layout: getLayoutProperties(),
            paint: getPaintProperties()
        };
        super(layer, properties, scope, lut, options);
        this._stats = {numRenderedVerticesInShadowPass: 0, numRenderedVerticesInTransparentPass: 0};
    }

    createBucket(parameters: BucketParameters<BuildingStyleLayer>): BuildingBucket {
        return new BuildingBucket(parameters);
    }
}

export default BuildingStyleLayer;
