'use strict';
var reference = require('mapbox-gl-style-spec');

module.exports = function(version) {
    if (!reference[version]) throw new Error('Reference version "' + version + '" undefined');

    var clone = namify(version, version, reference[version]);

    // interpolate transitionable properties.
    for (var i in clone) {
        if (typeof clone[i] !== 'object' || Array.isArray(clone[i])) continue;
        for (var j in clone[i]) {
            if (clone[i][j].transition) {
                clone[i]['transition-' + j] = { type: 'transition' };
            }
        }
    }

    return clone;
};

function namify(p, k, val) {
    if (typeof val !== 'object') return val;
    var clone, j;
    if (Array.isArray(val)) {
        clone = [];
        clone.__name__ = k;
        for (j in val) {
            clone[j] = namify(p, k, val[j]);
        }
    } else {
        clone = {};
        clone.__name__ = k;
        for (j in val) {
            clone[j] = namify(k, j, val[j]);
        }
    }
    return clone;
}
