// @flow

const Point = require('@mapbox/point-geometry');
const toGeoJSON = require('@mapbox/vector-tile').VectorTileFeature.prototype.toGeoJSON;
const EXTENT = require('../data/extent');

// The feature type used by geojson-vt and supercluster. Should be extracted to
// global type and used in module definitions for those two modules.
type Feature = {
    type: 1,
    id: mixed,
    tags: {[string]: string | number | boolean},
    geometry: Array<[number, number]>,
} | {
    type: 2 | 3,
    id: mixed,
    tags: {[string]: string | number | boolean},
    geometry: Array<Array<[number, number]>>,
}

class FeatureWrapper implements VectorTileFeature {
    _feature: Feature;

    extent: number;
    type: 1 | 2 | 3;
    id: number;
    properties: {[string]: string | number | boolean};

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
        if ('id' in feature && !isNaN(feature.id)) {
            this.id = parseInt(feature.id, 10);
        }
    }

    loadGeometry() {
        if (this._feature.type === 1) {
            const geometry = [];
            for (const point of this._feature.geometry) {
                geometry.push([new Point(point[0], point[1])]);
            }
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
            return geometry;
        }
    }

    bbox() {
        const rings = this.loadGeometry();
        let x1 = Infinity,
            x2 = -Infinity,
            y1 = Infinity,
            y2 = -Infinity;

        for (let i = 0; i < rings.length; i++) {
            const ring = rings[i];

            for (let j = 0; j < ring.length; j++) {
                const coord = ring[j];

                x1 = Math.min(x1, coord.x);
                x2 = Math.max(x2, coord.x);
                y1 = Math.min(y1, coord.y);
                y2 = Math.max(y2, coord.y);
            }
        }

        return [x1, y1, x2, y2];
    }

    toGeoJSON(x: number, y: number, z: number) {
        return toGeoJSON.call(this, x, y, z);
    }
}

class GeoJSONWrapper implements VectorTile, VectorTileLayer {
    layers: {[string]: VectorTileLayer};
    name: string;
    extent: number;
    length: number;
    _features: Array<Feature>;

    constructor(features: Array<Feature>) {
        this.layers = { '_geojsonTileLayer': this };
        this.name = '_geojsonTileLayer';
        this.extent = EXTENT;
        this.length = features.length;
        this._features = features;
    }

    feature(i: number): VectorTileFeature {
        return new FeatureWrapper(this._features[i]);
    }
}

module.exports = GeoJSONWrapper;
