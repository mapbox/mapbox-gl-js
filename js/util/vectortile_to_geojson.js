'use strict';

var VectorTileFeature = require('vector-tile').VectorTileFeature;

module.exports = Feature;

function Feature(vectorTileFeature, z, x, y) {
    this._vectorTileFeature = vectorTileFeature;
    vectorTileFeature._z = z;
    vectorTileFeature._x = x;
    vectorTileFeature._y = y;

    this.properties = vectorTileFeature.properties;

    if (vectorTileFeature._id) {
        this.id = vectorTileFeature._id;
    }
}

Feature.prototype = {
    type: "Feature",

    get geometry() {
        if (this._geometry === undefined) {
            var feature = this._vectorTileFeature;
            var coords = projectCoords(
                feature.loadGeometry(),
                feature.extent,
                feature._z, feature._x, feature._y);

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
    },

    set geometry(g) {
        this._geometry = g;
    },

    toJSON: function() {
        var json = {};
        for (var i in this) {
            if (i === '_geometry' || i === '_vectorTileFeature') continue;
            json[i] = this[i];
        }
        return json;
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
