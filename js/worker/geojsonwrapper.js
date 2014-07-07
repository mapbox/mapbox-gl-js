'use strict';

module.exports = Wrapper;

// conform to vectortile api
function Wrapper(features) {
    this.features = features;
    this.length = features.length;
}

Wrapper.prototype.feature = function(i) {
    return new FeatureWrapper(this.features[i]);
};

var mapping = {
    'Point': 1,
    'LineString': 2,
    'Polygon': 3
};

function FeatureWrapper(feature) {
    this.feature = feature;
    this._type = mapping[feature.type];
    this.properties = feature.properties;
}

FeatureWrapper.prototype.loadGeometry = function() {
    return this.feature.coords;
};

FeatureWrapper.prototype.bbox = function() {
    var rings = this.feature.coords;

    var x1 = Infinity,
        x2 = -Infinity,
        y1 = Infinity,
        y2 = -Infinity;

    for (var i = 0; i < rings.length; i++) {
        var ring = rings[i];

        for (var j = 0; j < ring.length; j++) {
            var coord = ring[j];

            x1 = Math.min(x1, coord.x);
            x2 = Math.max(x2, coord.x);
            y1 = Math.min(y1, coord.y);
            y2 = Math.max(y2, coord.y);
        }
    }

    return [x1, y1, x2, y2];
};
