'use strict';

var VectorTileFeature = require('vector-tile').VectorTileFeature;

module.exports = Feature;

function Feature(vectorTileFeature, z, x, y) {
    this._vectorTileFeature = vectorTileFeature;
    this._z = z;
    this._x = x;
    this._y = y;

    this.properties = vectorTileFeature.properties;

    if (vectorTileFeature._id) {
        this.id = vectorTileFeature._id;
    }
}

Feature.prototype = {
    type: "Feature",

    get geometry() {
        if (!this._geometry) {
            var feature = this._vectorTileFeature;
            var coords = projectCoords(
                feature.loadGeometry(),
                feature.extent,
                this._z, this._x, this._y);

            var type = VectorTileFeature.types[feature.type];

            if (type === 'Point' && coords.length === 1) {
                coords = coords[0][0];
            } else if (type === 'Point') {
                coords = coords[0];
                type = 'MultiPoint';
            } else if (type === 'LineString' && coords.length === 1) {
                coords = coords[0];
            } else if (type === 'LineString') {
                type = 'MultiLineString';
            }

            this._geometry = {
                type: type,
                coordinates: coords
            };

            this._vectorTileFeature = null;
        }
        return this._geometry;
    }
};

function projectCoords(coords, extent, z, x, y) {
    var size = extent * Math.pow(2, z),
        x0 = extent * x,
        y0 = extent * y;
    for (var i = 0; i < coords.length; i++) {
        var line = coords[i];
        for (var j = 0; j < line.length; j++) {
            var p = line[j];
            var y2 = 180 - (p.y + y0) * 360 / size;
            line[j] = [
                (p.x + x0) * 360 / size - 180,
                360 / Math.PI * Math.atan(Math.exp(y2 * Math.PI / 180)) - 90
            ];
        }
    }
    return coords;
}
