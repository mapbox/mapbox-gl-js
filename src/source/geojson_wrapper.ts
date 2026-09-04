import Point from '@mapbox/point-geometry';
import {VectorTileFeature} from '@mapbox/vector-tile';
const toGeoJSON = VectorTileFeature.prototype.toGeoJSON;
import EXTENT from '../style-spec/data/extent';

import type {VectorTile, VectorTileLayer} from '@mapbox/vector-tile';

type VectorTileFeatureLike = Pick<VectorTileFeature, 'properties' | 'extent' | 'type' | 'id' | 'loadGeometry' | 'toGeoJSON'>;
type VectorTileLayerLike = Pick<VectorTileLayer, 'name' | 'extent' | 'length' | 'feature'>;

// The raw tile envelope produced by geojson-vt's and supercluster's `getTileRaw`, and by
// `geojson_rt.ts` in dynamic mode: coordinates are flat `[x, y, x, y, …]` typed arrays, one per
// ring, and a lone point keeps its coordinates inline as `type: 4` instead of allocating an array.
export type Feature = {
    id?: number | string;
    tags: Record<string, unknown> | null | undefined;
} & ({
    type: 4;
    x: number;
    y: number;
} | {
    type: 1;
    geometry: Int16Array | Int32Array;
} | {
    type: 2 | 3;
    geometry: (Int16Array | Int32Array)[];
});

class FeatureWrapper implements VectorTileFeatureLike {
    _feature: Feature;

    extent: number;
    type: 1 | 2 | 3;
    id: number | undefined;
    properties: {
        [_: string]: string | number | boolean;
    };

    constructor(feature: Feature) {
        this._feature = feature;

        this.extent = EXTENT;
        // a lone point (type 4) is still a vector tile point; only its storage differs
        this.type = feature.type === 4 ? 1 : feature.type;
        this.properties = (feature.tags || {}) as {[_: string]: string | number | boolean};

        // If the feature has a top-level `id` property, copy it over, but only
        // if it can be coerced to an integer, because this wrapper is used for
        // serializing geojson feature data into vector tile PBF data, and the
        // vector tile spec only supports integer values for feature ids --
        // allowing non-integer values here results in a non-compliant PBF
        // that causes an exception when it is parsed with vector-tile-js
        if ('id' in feature && !isNaN(feature.id as number)) {
            this.id = parseInt(feature.id as string, 10);
        }
    }

    loadGeometry(): Array<Array<Point>> {
        const feature = this._feature;
        const geometry: Array<Array<Point>> = [];

        if (feature.type === 4) {
            geometry.push([new Point(feature.x, feature.y)]);

        } else if (feature.type === 1) {
            // multipoints are one point per part, matching the vector tile spec's point encoding
            for (let i = 0; i < feature.geometry.length; i += 2) {
                geometry.push([new Point(feature.geometry[i]!, feature.geometry[i + 1]!)]);
            }

        } else {
            for (const ring of feature.geometry) {
                const newRing: Array<Point> = [];
                for (let i = 0; i < ring.length; i += 2) {
                    newRing.push(new Point(ring[i]!, ring[i + 1]!));
                }
                geometry.push(newRing);
            }
        }
        return geometry;
    }

    toGeoJSON(x: number, y: number, z: number): GeoJSON.Feature {
        return toGeoJSON.call(this, x, y, z);
    }
}

class LayerWrapper implements VectorTileLayerLike {
    name: string;
    extent: number;
    length: number;
    _jsonFeatures: readonly Feature[];

    constructor(name: string, features: readonly Feature[]) {
        this.name = name;
        this.extent = EXTENT;
        this.length = features.length;
        this._jsonFeatures = features;
    }

    feature(i: number): VectorTileFeature {
        return new FeatureWrapper(this._jsonFeatures[i]!) as unknown as VectorTileFeature;
    }
}

class GeoJSONWrapper implements VectorTile {
    layers: Record<string, VectorTileLayer>;
    extent: number;

    constructor(layers: {[_: string]: readonly Feature[]}) {
        this.layers = {};
        this.extent = EXTENT;

        for (const name of Object.keys(layers)) {
            this.layers[name] = new LayerWrapper(name, layers[name]!) as unknown as VectorTileLayer;
        }
    }
}

export default GeoJSONWrapper;
