'use strict';
var reference = require('mapbox-gl-style-spec');

module.exports = function(version) {
    if (!reference[version]) throw new Error('Reference version "' + version + '" undefined');

    var clone = namify('version', reference[version]);

    // interpolate transitionable properties.
    // bucket properties cannot be transitioned
    if (clone.style) for (var i in clone.style) {
        if (clone.style[i].transition) {
            clone.style['transition-' + i] = { type: 'transition' };
        }
    }

    return clone;
};

function namify(k, val) {
    if (typeof val !== 'object') return val;
    var clone = Array.isArray(val) ? [] : {};
    clone.__name__ = k;
    for (var j in val) {
        clone[j] = namify(j, val[j]);
    }
    return clone;
}
