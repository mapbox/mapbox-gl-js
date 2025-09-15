import StyleLayer from '../../../src/style/style_layer';
import BuildingBucket from '../../data/bucket/building_bucket';
import {getLayoutProperties, getPaintProperties} from './building_style_layer_properties';

import type {Layout, Transitionable, Transitioning, PossiblyEvaluated, ConfigOptions} from '../../../src/style/properties';
import type {BucketParameters} from '../../../src/data/bucket';
import type {PaintProps, LayoutProps} from './building_style_layer_properties';
import type {LayerSpecification} from '../../../src/style-spec/types';
import type {LUT} from "../../../src/util/lut";

class BuildingStyleLayer extends StyleLayer {
    override type: 'building';

    override _unevaluatedLayout: Layout<LayoutProps>;
    override layout: PossiblyEvaluated<LayoutProps>;

    override _transitionablePaint: Transitionable<PaintProps>;
    override _transitioningPaint: Transitioning<PaintProps>;
    override paint: PossiblyEvaluated<PaintProps>;

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

    override cutoffRange(): number {
        return this.paint.get('building-cutoff-fade-range');
    }

    override hasShadowPass(): boolean {
        return this.paint.get('building-cast-shadows');
    }

    override hasLightBeamPass(): boolean {
        return true;
    }

    override canCastShadows(): boolean {
        return true;
    }

    override is3D(terrainEnabled?: boolean): boolean {
        return true;
    }
}

export default BuildingStyleLayer;
