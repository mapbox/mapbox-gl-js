// @flow

import loadGeometry from './load_geometry.js';

import type Point from '@mapbox/point-geometry';

type EvaluationFeature = {
    +type: 1 | 2 | 3 | 'Unknown' | 'Point' | 'MultiPoint' | 'LineString' | 'MultiLineString' | 'Polygon' | 'MultiPolygon',
    +id?: any,
    +properties: {[_: string]: any},
    +patterns?: {[_: string]: {"min": string, "mid": string, "max": string}},
    geometry: Array<Array<Point>>
};

/**
 * Construct a new feature based on a VectorTileFeature for expression evaluation, the geometry of which
 * will be loaded based on necessity.
 * @param {VectorTileFeature} feature
 * @param {boolean} needGeometry
 * @private
 */
export default function toEvaluationFeature(feature: VectorTileFeature, needGeometry: boolean): EvaluationFeature {
    return {type: feature.type,
        id: feature.id,
        properties:feature.properties,
        geometry: needGeometry ? loadGeometry(feature) : []};
}
