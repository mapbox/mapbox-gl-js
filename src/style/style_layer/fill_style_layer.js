// @flow

import StyleLayer from '../style_layer';

import FillBucket from '../../data/bucket/fill_bucket';
import {polygonIntersectsMultiPolygon} from '../../util/intersection_tests';
import {translateDistance, translate} from '../query_utils';
import properties from './fill_style_layer_properties';
import {Transitionable, Transitioning, Layout, PossiblyEvaluated} from '../properties';

import type {FeatureState} from '../../style-spec/expression';
import Color from '../../style-spec/util/color';
import type {BucketParameters} from '../../data/bucket';
import type Point from '@mapbox/point-geometry';
import type {LayoutProps, PaintProps} from './fill_style_layer_properties';
import type EvaluationParameters from '../evaluation_parameters';
import type Transform from '../../geo/transform';
import type {LayerSpecification} from '../../style-spec/types';
import type Painter from '../../render/painter';
import ProgramConfiguration from '../../data/program_configuration';

class FillStyleLayer extends StyleLayer {
    _unevaluatedLayout: Layout<LayoutProps>;
    layout: PossiblyEvaluated<LayoutProps>;

    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;

    constructor(layer: LayerSpecification) {
        super(layer, properties);
    }

    getProgramId(painter: ?Painter): string {
        if (!painter) return '';
        const pattern = this.paint.get('fill-pattern');
        const color = this.paint.get('fill-color');
        const opacity = this.paint.get('fill-opacity');

        const patternProperty = this.paint.get('fill-pattern');
        const image = patternProperty && patternProperty.constantOr((1: any));

        const pass = painter.opaquePassEnabledForLayer() &&
        (!pattern.constantOr((1: any)) &&
        color.constantOr(Color.transparent).a === 1 &&
        opacity.constantOr(0) === 1) ? 'opaque' : 'translucent';

        if (painter.renderPass === pass) {
            return image ? 'fillPattern' : 'fill';
        } else if (painter.renderPass === 'translucent' && this.paint.get('fill-antialias')) {
            return image && !this.getPaintProperty('fill-outline-color') ? 'fillOutlinePattern' : 'fillOutline';
        }
        return '';
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

    queryIntersectsFeature(queryGeometry: Array<Point>,
                           feature: VectorTileFeature,
                           featureState: FeatureState,
                           geometry: Array<Array<Point>>,
                           zoom: number,
                           transform: Transform,
                           pixelsToTileUnits: number): boolean {
        const translatedPolygon = translate(queryGeometry,
            this.paint.get('fill-translate'),
            this.paint.get('fill-translate-anchor'),
            transform.angle, pixelsToTileUnits);
        return polygonIntersectsMultiPolygon(translatedPolygon, geometry);
    }

    isTileClipped() {
        return true;
    }
}

export default FillStyleLayer;
