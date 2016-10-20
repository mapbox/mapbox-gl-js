'use strict';

const Point = require('point-geometry');
const VectorTileFeature = require('vector-tile').VectorTileFeature;
const EXTENT = require('../data/extent');

class FeatureWrapper {

    constructor(feature) {
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
        VectorTileFeature.prototype.toGeoJSON.call(this);
    }
}

// conform to vectortile api
class GeoJSONWrapper {

    constructor(features) {
        this.features = features;
        this.length = features.length;
        this.extent = EXTENT;
    }

    feature(i) {
        return new FeatureWrapper(this.features[i]);
    }
}

module.exports = GeoJSONWrapper;
