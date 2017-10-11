// @flow

const StyleLayer = require('../style_layer');
const FillExtrusionBucket = require('../../data/bucket/fill_extrusion_bucket');
const {multiPolygonIntersectsMultiPolygon} = require('../../util/intersection_tests');
const {translateDistance, translate} = require('../query_utils');

import type {Feature, GlobalProperties} from '../../style-spec/expression';
import type {BucketParameters} from '../../data/bucket';
import type Point from '@mapbox/point-geometry';

class FillExtrusionStyleLayer extends StyleLayer {

    getPaintValue(name: string, globals: GlobalProperties, feature?: Feature) {
        const value = super.getPaintValue(name, globals, feature);
        if (name === 'fill-extrusion-color' && value) {
            value[3] = 1;
        }
        return value;
    }

    createBucket(parameters: BucketParameters) {
        return new FillExtrusionBucket(parameters);
    }

    isOpacityZero(zoom: number) {
        return this.getPaintValue('fill-extrusion-opacity', { zoom: zoom }) === 0;
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

    resize(gl: WebGLRenderingContext) {
        if (this.viewportFrame) {
            const {texture, fbo} = this.viewportFrame;
            gl.deleteTexture(texture);
            gl.deleteFramebuffer(fbo);
            this.viewportFrame = null;
        }
    }
}

module.exports = FillExtrusionStyleLayer;
