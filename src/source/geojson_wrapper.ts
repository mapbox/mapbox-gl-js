import Point from '@mapbox/point-geometry';
import {VectorTileFeature} from '@mapbox/vector-tile';
const toGeoJSON = VectorTileFeature.prototype.toGeoJSON;
import EXTENT from '../style-spec/data/extent';

import type {VectorTile, VectorTileLayer} from '@mapbox/vector-tile';

// The feature type used by geojson-vt and supercluster. Should be extracted to
// global type and used in module definitions for those two modules.
export type Feature = {
    type: 1;
    id: unknown;
    tags: {
        [_: string]: string | number | boolean;
    };
    geometry: Array<[number, number]>;
} | {
    type: 2 | 3;
    id: unknown;
    tags: {
        [_: string]: string | number | boolean;
    };
    geometry: Array<Array<[number, number]>>;
};

// @ts-expect-error TS2739
class FeatureWrapper implements VectorTileFeature {
    _feature: Feature;

    extent: number;
    type: 1 | 2 | 3;
    id: number;
    properties: {
        [_: string]: string | number | boolean;
    };

    constructor(feature: Feature) {
        this._feature = feature;

        this.extent = EXTENT;
        this.type = feature.type;
        this.properties = feature.tags;

        // If the feature has a top-level `id` property, copy it over, but only
        // if it can be coerced to an integer, because this wrapper is used for
        // serializing geojson feature data into vector tile PBF data, and the
        // vector tile spec only supports integer values for feature ids --
        // allowing non-integer values here results in a non-compliant PBF
        // that causes an exception when it is parsed with vector-tile-js
        // @ts-expect-error - TS2345 - Argument of type 'unknown' is not assignable to parameter of type 'number'.
        if ('id' in feature && !isNaN(feature.id)) {
            // @ts-expect-error - TS2345 - Argument of type 'unknown' is not assignable to parameter of type 'string'.
            this.id = parseInt(feature.id, 10);
        }
    }

    loadGeometry(): Array<Array<Point>> {
        if (this._feature.type === 1) {
            const geometry = [];
            for (const point of this._feature.geometry) {
                geometry.push([new Point(point[0], point[1])]);
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return geometry;
        } else {
            const geometry = [];
            for (const ring of this._feature.geometry) {
                const newRing = [];
                for (const point of ring) {
                    newRing.push(new Point(point[0], point[1]));
                }
                geometry.push(newRing);
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return geometry;
        }
    }

    toGeoJSON(x: number, y: number, z: number): GeoJSON.Feature {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return toGeoJSON.call(this, x, y, z);
    }
}

// @ts-expect-error TS2739
class LayerWrapper implements VectorTileLayer {
    name: string;
    extent: number;
    length: number;
    _jsonFeatures: Array<Feature>;

    constructor(name: string, features: Array<Feature>) {
        this.name = name;
        this.extent = EXTENT;
        this.length = features.length;
        this._jsonFeatures = features;
    }

    feature(i: number): VectorTileFeature {
        // @ts-expect-error TS2739: Type 'FeatureWrapper' is missing the following properties from type 'VectorTileFeature': _pbf, _geometry, _keys, _values, bbox
        return new FeatureWrapper(this._jsonFeatures[i]);
    }
}

class GeoJSONWrapper implements VectorTile {
    layers: Record<string, VectorTileLayer>;
    extent: number;

    constructor(layers: {[_: string]: Array<Feature>}) {
        this.layers = {};
        this.extent = EXTENT;

        for (const name of Object.keys(layers)) {
            // @ts-expect-error TS2739
            this.layers[name] = new LayerWrapper(name, layers[name]);
        }
    }
}

export default GeoJSONWrapper;
