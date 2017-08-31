// @flow

const StyleLayer = require('../style_layer');
const FillExtrusionBucket = require('../../data/bucket/fill_extrusion_bucket');
const {multiPolygonIntersectsMultiPolygon} = require('../../util/intersection_tests');
const {translateDistance, translate} = require('../query_utils');

import type {Feature} from '../../style-spec/function';
import type {GlobalProperties} from '../style_layer';
import type {BucketParameters} from '../../data/bucket';
import type Point from '@mapbox/point-geometry';

class FillExtrusionStyleLayer extends StyleLayer {

    getPaintValue(name: string, globalProperties?: GlobalProperties, feature?: Feature) {
        const value = super.getPaintValue(name, globalProperties, feature);
        if (name === 'fill-extrusion-color' && value) {
            value[3] = 1;
        }
        return value;
    }

    createBucket(parameters: BucketParameters) {
        return new FillExtrusionBucket(parameters);
    }

    queryRadius(): number {
        return translateDistance(this.paint['fill-extrusion-translate']);
    }

    queryIntersectsFeature(queryGeometry: Array<Array<Point>>,
                           feature: VectorTileFeature,
                           geometry: Array<Array<Point>>,
                           zoom: number,
                           bearing: number,
                           pixelsToTileUnits: number): boolean {
        const translatedPolygon = translate(queryGeometry,
            this.getPaintValue('fill-extrusion-translate', {zoom}, feature),
            this.getPaintValue('fill-extrusion-translate-anchor', {zoom}, feature),
            bearing, pixelsToTileUnits);
        return multiPolygonIntersectsMultiPolygon(translatedPolygon, geometry);
    }

    has3DPass() {
        return this.paint['fill-extrusion-opacity'] !== 0 && this.layout['visibility'] !== 'none';
    }
}

module.exports = FillExtrusionStyleLayer;
