'use strict';

var util = require('../util/util');
var EXTENT = require('./bucket').EXTENT;

var boundsCache = {};

/**
 * Loads a geometry from a VectorTileFeature and scales it to the common extent
 * used internally.
 * @param {VectorTileFeature} feature
 * @param {number} [bits=16] The number of signed integer bits available to store
 *   each coordinate. A warning will be issued if any coordinate will not fits
 *   in the specified number of bits.
 * @private
 */
module.exports = function loadGeometry(feature, bits) {
    bits = bits || 16;

    if (!boundsCache[bits]) {
        boundsCache[bits] = {
            min: -1 * Math.pow(2, bits - 1),
            max: Math.pow(2, bits - 1) - 1
        };
    }
    var bounds = boundsCache[bits];

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

            if (point.x < bounds.min || point.x > bounds.max || point.y < bounds.min || point.y > bounds.max) {
                util.warnOnce('Geometry exceeds allowed extent, reduce your vector tile buffer size');
            }
        }
    }
    return geometry;
};
