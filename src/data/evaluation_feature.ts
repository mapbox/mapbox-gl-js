import loadGeometry from './load_geometry';

import type Point from '@mapbox/point-geometry';
import type {VectorTileFeature} from '@mapbox/vector-tile';

export type EvaluationFeature = {
    readonly type: 0 | 1 | 2 | 3 | 'Unknown' | 'Point' | 'LineString' | 'Polygon';
    readonly id?: any;
    readonly properties: {
        [_: string]: any;
    };
    readonly patterns?: {
        [_: string]: string;
    };
    geometry: Array<Array<Point>>;
};

/**
 * Construct a new feature based on a VectorTileFeature for expression evaluation, the geometry of which
 * will be loaded based on necessity.
 * @param {VectorTileFeature} feature
 * @param {boolean} needGeometry
 * @private
 */
export default function toEvaluationFeature(feature: VectorTileFeature, needGeometry: boolean): EvaluationFeature {
    return {
        type: feature.type,
        id: feature.id,
        properties:feature.properties,
        geometry: needGeometry ? loadGeometry(feature) : []
    };
}
