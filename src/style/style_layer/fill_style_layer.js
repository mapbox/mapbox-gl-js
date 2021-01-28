// @flow

import StyleLayer from '../style_layer.js';

import FillBucket from '../../data/bucket/fill_bucket.js';
import {polygonIntersectsMultiPolygon} from '../../util/intersection_tests.js';
import {translateDistance, translate} from '../query_utils.js';
import properties from './fill_style_layer_properties.js';
import {Transitionable, Transitioning, Layout, PossiblyEvaluated} from '../properties.js';
import ProgramConfiguration from '../../data/program_configuration.js';

import type {FeatureState} from '../../style-spec/expression/index.js';
import type {BucketParameters} from '../../data/bucket.js';
import type Point from '@mapbox/point-geometry';
import type {LayoutProps, PaintProps} from './fill_style_layer_properties.js';
import type EvaluationParameters from '../evaluation_parameters.js';
import type Transform from '../../geo/transform.js';
import type {LayerSpecification} from '../../style-spec/types.js';
import type {TilespaceQueryGeometry} from '../query_geometry.js';

class FillStyleLayer extends StyleLayer {
    _unevaluatedLayout: Layout<LayoutProps>;
    layout: PossiblyEvaluated<LayoutProps>;

    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;

    constructor(layer: LayerSpecification) {
        super(layer, properties);
    }

    getProgramIds(): string[] {
        const pattern = this.paint.get('fill-pattern');
        const image = pattern && pattern.constantOr((1: any));

        const ids = [image ? 'fillPattern' : 'fill'];

        if (this.paint.get('fill-antialias')) {
            ids.push(image && !this.getPaintProperty('fill-outline-color') ? 'fillOutlinePattern' : 'fillOutline');
        }

        return ids;
    }

    getProgramConfiguration(zoom: number): ProgramConfiguration {
        return new ProgramConfiguration(this, zoom);
    }

    recalculate(parameters: EvaluationParameters, availableImages: Array<string>) {
        super.recalculate(parameters, availableImages);

        const outlineColor = this.paint._values['fill-outline-color'];
        if (outlineColor.value.kind === 'constant' && outlineColor.value.value === undefined) {
            this.paint._values['fill-outline-color'] = this.paint._values['fill-color'];
        }
    }

    createBucket(parameters: BucketParameters<*>) {
        return new FillBucket(parameters);
    }

    queryRadius(): number {
        return translateDistance(this.paint.get('fill-translate'));
    }

    queryIntersectsFeature(queryGeometry: TilespaceQueryGeometry,
                           feature: VectorTileFeature,
                           featureState: FeatureState,
                           geometry: Array<Array<Point>>,
                           zoom: number,
                           transform: Transform): boolean {
        if (queryGeometry.queryGeometry.isAboveHorizon) return false;

        const translatedPolygon = translate(queryGeometry.tilespaceGeometry,
            this.paint.get('fill-translate'),
            this.paint.get('fill-translate-anchor'),
            transform.angle, queryGeometry.pixelToTileUnitsFactor);
        return polygonIntersectsMultiPolygon(translatedPolygon, geometry);
    }

    isTileClipped() {
        return true;
    }
}

export default FillStyleLayer;
