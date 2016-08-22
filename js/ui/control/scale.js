'use strict';
var util = require('../../util/util');
var Control = require('./control');
var DOM = require('../../util/dom');

module.exports = Scale;

/**
 * A `Scale` control displays the ratio of a distance on the map to the corresponding distance on the ground.
 * Extends [`Control`](#Control).
 *
 * @class Scale
 * @param {Object} [options]
 * @param {string} [options.position='bottom-left'] A string indicating the control's position on the map. Options are `'top-right'`, `'top-left'`, `'bottom-right'`, and `'bottom-left'`.
 * @param {number} [options.maxWidth='150'] The maximum length of the scale control in pixels.
 * @example
 * map.addControl(new mapboxgl.Scale({position: 'top-left'})); // position is optional
 * map.addControl(new mapboxgl.Scale({maxWidth: 80})); //maxWidth is optional
 */
function Scale(options) {
    util.setOptions(this, options);
}

Scale.prototype = util.inherit(Control, {
    options: {
        position: 'bottom-left'
    },

    onAdd: function(map) {
        var className = 'mapboxgl-ctrl-scale',
            container = this._container = DOM.create('div', className, map.getContainer()),
            options = this.options;

        updateScale(map, container, options);
        map.on('move', function() {
            updateScale(map, container, options);
        });

        return container;
    }
});

function updateScale(map, scale, options) {
    // A horizontal scale is imagined to be present at center of the map
    // container with maximum length (Default) as 100px.
    // Using spherical law of cosines approximation, the real distance is
    // found between the two coordinates.
    var maxWidth = options && options.maxWidth || 100;

    var y = map._container.clientHeight / 2;
    var maxMeters = getDistance(map.unproject([0, y]), map.unproject([maxWidth, y]));

    // The real distance corresponding to 100px scale length is rounded off to
    // near pretty number and the scale length for the same is found out.
    var meters = getRoundNum(maxMeters);
    var ratio = meters / maxMeters;
    scale.style.width = maxWidth * ratio + 'px';
    scale.innerHTML = meters < 1000 ? meters + ' m' : (meters / 1000) + ' km';

}

function getDistance(latlng1, latlng2) {
    // Uses spherical law of cosines approximation.
    var R = 6371000;

    var rad = Math.PI / 180,
        lat1 = latlng1.lat * rad,
        lat2 = latlng2.lat * rad,
        a = Math.sin(lat1) * Math.sin(lat2) +
          Math.cos(lat1) * Math.cos(lat2) * Math.cos((latlng2.lng - latlng1.lng) * rad);

    var maxMeters = R * Math.acos(Math.min(a, 1));
    return maxMeters;

}

function getRoundNum(num) {
    var pow10 = Math.pow(10, (Math.floor(num) + '').length - 1),
        d = num / pow10;

    d = d >= 10 ? 10 :
        d >= 5 ? 5 :
        d >= 3 ? 3 :
        d >= 2 ? 2 : 1;

    return pow10 * d;
}
