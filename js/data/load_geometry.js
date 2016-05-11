'use strict';

var util = require('../util/util');

var EXTENT = require('./bucket').EXTENT;
var EXTENT_MIN = EXTENT * -2;
var EXTENT_MAX = (EXTENT * 2) - 1;

/**
 * Loads a geometry from a VectorTileFeature and scales it to the common extent
 * used internally.
 * @private
 */
module.exports = function loadGeometry(feature) {
    var scale = EXTENT / feature.extent;
    var geometry = feature.loadGeometry();
    for (var r = 0; r < geometry.length; r++) {
        var ring = geometry[r];
        for (var p = 0; p < ring.length; p++) {
            var point = ring[p];
            // round here because mapbox-gl-native uses integers to represent
            // points and we need to do the same to avoid renering differences.
            point.x = Math.round(point.x * scale);
            point.y = Math.round(point.y * scale);
            if (
                point.x < EXTENT_MIN ||
                point.x > EXTENT_MAX ||
                point.y < EXTENT_MIN ||
                point.y > EXTENT_MAX) {
                util.warnOnce('Geometry exceeds allowed extent, reduce your vector tile buffer size');
            }
        }
    }
    return geometry;
};
