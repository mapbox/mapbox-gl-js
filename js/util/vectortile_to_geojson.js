'use strict';

module.exports = Feature;

function Feature(vectorTileFeature, z, x, y) {
    this._vectorTileFeature = vectorTileFeature;
    vectorTileFeature._z = z;
    vectorTileFeature._x = x;
    vectorTileFeature._y = y;

    this.properties = vectorTileFeature.properties;

    if (vectorTileFeature.id != null) {
        this.id = vectorTileFeature.id;
    }
}

Feature.prototype = {
    type: "Feature",

    get geometry() {
        if (this._geometry === undefined) {
            this._geometry = this._vectorTileFeature.toGeoJSON(
                this._vectorTileFeature._x,
                this._vectorTileFeature._y,
                this._vectorTileFeature._z).geometry;
        }
        return this._geometry;
    },

    set geometry(g) {
        this._geometry = g;
    },

    toJSON: function() {
        var json = {};
        for (var i in this) {
            if (i === '_geometry' || i === '_vectorTileFeature' || i === 'toJSON') continue;
            json[i] = this[i];
        }
        return json;
    }
};
