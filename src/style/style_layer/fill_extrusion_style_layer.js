// @flow

const StyleLayer = require('../style_layer');
const FillExtrusionBucket = require('../../data/bucket/fill_extrusion_bucket');
const {multiPolygonIntersectsMultiPolygon} = require('../../util/intersection_tests');
const {translateDistance, translate} = require('../query_utils');
const properties = require('./fill_extrusion_style_layer_properties');

const {
    Transitionable,
    Transitioning,
    PossiblyEvaluated
} = require('../properties');

import type {BucketParameters} from '../../data/bucket';
import type Point from '@mapbox/point-geometry';
import type {PaintProps} from './fill_extrusion_style_layer_properties';
import type Framebuffer from '../../gl/framebuffer';

class FillExtrusionStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;
    viewportFrame: ?Framebuffer;

    constructor(layer: LayerSpecification) {
        super(layer, properties);
    }

    createBucket(parameters: BucketParameters<FillExtrusionStyleLayer>) {
        return new FillExtrusionBucket(parameters);
    }

    queryRadius(): number {
        return translateDistance(this.paint.get('fill-extrusion-translate'));
    }

    queryIntersectsFeature(queryGeometry: Array<Array<Point>>,
                           feature: VectorTileFeature,
                           geometry: Array<Array<Point>>,
                           zoom: number,
                           bearing: number,
                           pixelsToTileUnits: number): boolean {
        const translatedPolygon = translate(queryGeometry,
            this.paint.get('fill-extrusion-translate'),
            this.paint.get('fill-extrusion-translate-anchor'),
            bearing, pixelsToTileUnits);
        return multiPolygonIntersectsMultiPolygon(translatedPolygon, geometry);
    }

    hasOffscreenPass() {
        return this.paint.get('fill-extrusion-opacity') !== 0 && this.visibility !== 'none';
    }

    resize() {
        if (this.viewportFrame) {
            this.viewportFrame.destroy();
            this.viewportFrame = null;
        }
    }
}

module.exports = FillExtrusionStyleLayer;
