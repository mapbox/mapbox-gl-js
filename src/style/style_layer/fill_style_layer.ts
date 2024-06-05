import StyleLayer from '../style_layer';

import FillBucket from '../../data/bucket/fill_bucket';
import {polygonIntersectsMultiPolygon} from '../../util/intersection_tests';
import {translateDistance, translate} from '../query_utils';
import properties from './fill_style_layer_properties';
import {Transitionable, Transitioning, Layout, PossiblyEvaluated} from '../properties';
import ProgramConfiguration from '../../data/program_configuration';

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
import type {ConfigOptions} from '../properties';
import type {LUT} from "../../util/lut";

class FillStyleLayer extends StyleLayer {
    _unevaluatedLayout: Layout<LayoutProps>;
    layout: PossiblyEvaluated<LayoutProps>;

    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;

    constructor(layer: LayerSpecification, scope: string, lut: LUT | null, options?: ConfigOptions | null) {
        super(layer, properties, scope, lut, options);
    }

    getProgramIds(): string[] {
        const pattern = this.paint.get('fill-pattern');

        const image = pattern && pattern.constantOr((1 as any));

        const ids = [image ? 'fillPattern' : 'fill'];

        if (this.paint.get('fill-antialias')) {
            ids.push(image && !this.getPaintProperty('fill-outline-color') ? 'fillOutlinePattern' : 'fillOutline');
        }

        return ids;
    }

    getDefaultProgramParams(name: string, zoom: number, lut: LUT | null): CreateProgramParams | null {
        return {
            config: new ProgramConfiguration(this, {zoom, lut}),
            overrideFog: false
        };
    }

    recalculate(parameters: EvaluationParameters, availableImages: Array<string>) {
        super.recalculate(parameters, availableImages);

        const outlineColor = this.paint._values['fill-outline-color'];

        if (outlineColor.value.kind === 'constant' && outlineColor.value.value === undefined) {
            this.paint._values['fill-outline-color'] = this.paint._values['fill-color'];
        }
    }

    createBucket(parameters: BucketParameters<FillStyleLayer>): FillBucket {
        return new FillBucket(parameters);
    }

    queryRadius(): number {

        return translateDistance(this.paint.get('fill-translate'));
    }

    queryIntersectsFeature(
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

    isTileClipped(): boolean {
        return true;
    }
}

export default FillStyleLayer;
