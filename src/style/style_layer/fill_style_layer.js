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
import type {IVectorTileFeature} from '@mapbox/vector-tile';
import type {CreateProgramParams} from "../../render/painter.js";
import type {ConfigOptions} from '../properties.js';

class FillStyleLayer extends StyleLayer {
    _unevaluatedLayout: Layout<LayoutProps>;
    layout: PossiblyEvaluated<LayoutProps>;

    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;

    constructor(layer: LayerSpecification, options?: ?ConfigOptions) {
        super(layer, properties, options);
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

    getDefaultProgramParams(name: string, zoom: number): CreateProgramParams | null {
        return {
            config: new ProgramConfiguration(this, zoom),
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

    // $FlowFixMe[method-unbinding]
    queryRadius(): number {
        return translateDistance(this.paint.get('fill-translate'));
    }

    // $FlowFixMe[method-unbinding]
    queryIntersectsFeature(queryGeometry: TilespaceQueryGeometry,
                           feature: IVectorTileFeature,
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

    isTileClipped(): boolean {
        return true;
    }
}

export default FillStyleLayer;
