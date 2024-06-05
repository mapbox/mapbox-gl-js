import loadGeometry from './load_geometry';

import type Point from '@mapbox/point-geometry';
import type {VectorTileFeature} from '@mapbox/vector-tile';

export type EvaluationFeature = {
    readonly type: 1 | 2 | 3 | 'Unknown' | 'Point' | 'LineString' | 'Polygon';
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
// @ts-expect-error - TS2322 - Type '0 | 2 | 1 | 3' is not assignable to type '2 | 1 | 3 | "Polygon" | "Point" | "LineString" | "Unknown"'.
    return {type: feature.type,
        id: feature.id,
        properties:feature.properties,
        // @ts-expect-error - TS2345 - Argument of type 'VectorTileFeature' is not assignable to parameter of type 'FeatureWithGeometry'.
        geometry: needGeometry ? loadGeometry(feature) : []};
}
