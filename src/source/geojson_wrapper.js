// @flow

const Point = require('point-geometry');
const toGeoJSON = require('vector-tile').VectorTileFeature.prototype.toGeoJSON;
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
    extent: number;
    type: 1 | 2 | 3;
    id: number;
    properties: {[string]: string | number | boolean};

    geometry: Array<Array<Point>>;
    rawGeometry: Array<Array<[number, number]>>;

    constructor(feature: Feature) {
        this.type = feature.type;
        if (feature.type === 1) {
            this.rawGeometry = [];
            for (let i = 0; i < feature.geometry.length; i++) {
                this.rawGeometry.push([feature.geometry[i]]);
            }
        } else {
            this.rawGeometry = feature.geometry;
        }
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
        this.extent = EXTENT;
    }

    loadGeometry() {
        const rings = this.rawGeometry;
        this.geometry = [];

        for (let i = 0; i < rings.length; i++) {
            const ring = rings[i],
                newRing = [];
            for (let j = 0; j < ring.length; j++) {
                newRing.push(new Point(ring[j][0], ring[j][1]));
            }
            this.geometry.push(newRing);
        }
        return this.geometry;
    }

    bbox() {
        if (!this.geometry) this.loadGeometry();

        const rings = this.geometry;
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

    toGeoJSON() {
        return toGeoJSON.apply(this, arguments);
    }
}

class GeoJSONWrapper implements VectorTile, VectorTileLayer {
    layers: {[string]: VectorTileLayer};
    name: string;
    extent: number;
    length: number;
    _features: Array<any>;

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
