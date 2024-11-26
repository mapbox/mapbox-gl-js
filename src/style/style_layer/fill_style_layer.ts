import StyleLayer from '../style_layer';
import FillBucket from '../../data/bucket/fill_bucket';
import {polygonIntersectsMultiPolygon} from '../../util/intersection_tests';
import {translateDistance, translate} from '../query_utils';
import {getLayoutProperties, getPaintProperties} from './fill_style_layer_properties';
import ProgramConfiguration from '../../data/program_configuration';

import type {Transitionable, Transitioning, Layout, PossiblyEvaluated, ConfigOptions} from '../properties';
import type {FeatureState} from '../../style-spec/expression/index';
import type {BucketParameters} from '../../data/bucket';
import type Point from '@mapbox/point-geometry';
import type {LayoutProps, PaintProps} from './fill_style_layer_properties';
import type EvaluationParameters from '../evaluation_parameters';
import type Transform from '../../geo/transform';
import type {LayerSpecification} from '../../style-spec/types';
import type {TilespaceQueryGeometry} from '../query_geometry';
import type {VectorTileFeature} from '@mapbox/vector-tile';
import type {CreateProgramParams} from '../../render/painter';
import type {LUT} from "../../util/lut";

class FillStyleLayer extends StyleLayer {
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
    }

    override getProgramIds(): string[] {
        const pattern = this.paint.get('fill-pattern');

        const image = pattern && pattern.constantOr((1 as any));

        const ids = [image ? 'fillPattern' : 'fill'];

        if (this.paint.get('fill-antialias')) {
            ids.push(image && !this.getPaintProperty('fill-outline-color') ? 'fillOutlinePattern' : 'fillOutline');
        }

        return ids;
    }

    override getDefaultProgramParams(name: string, zoom: number, lut: LUT | null): CreateProgramParams | null {
        return {
            config: new ProgramConfiguration(this, {zoom, lut}),
            overrideFog: false
        };
    }

    override recalculate(parameters: EvaluationParameters, availableImages: Array<string>) {
        super.recalculate(parameters, availableImages);

        const outlineColor = this.paint._values['fill-outline-color'];

        if (outlineColor.value.kind === 'constant' && outlineColor.value.value === undefined) {
            this.paint._values['fill-outline-color'] = this.paint._values['fill-color'];
        }
    }

    createBucket(parameters: BucketParameters<FillStyleLayer>): FillBucket {
        return new FillBucket(parameters);
    }

    override queryRadius(): number {
        return translateDistance(this.paint.get('fill-translate'));
    }

    override queryIntersectsFeature(
        queryGeometry: TilespaceQueryGeometry,
        feature: VectorTileFeature,
        featureState: FeatureState,
        geometry: Array<Array<Point>>,
        zoom: number,
        transform: Transform,
    ): boolean {
        if (queryGeometry.queryGeometry.isAboveHorizon) return false;

        const translatedPolygon = translate(queryGeometry.tilespaceGeometry,

            this.paint.get('fill-translate'),
            this.paint.get('fill-translate-anchor'),
            transform.angle, queryGeometry.pixelToTileUnitsFactor);
        return polygonIntersectsMultiPolygon(translatedPolygon, geometry);
    }

    override isTileClipped(): boolean {
        return true;
    }

    override is3D(): boolean {
        return this.paint.get('fill-z-offset').constantOr(1.0) !== 0.0;
    }
}

export default FillStyleLayer;
