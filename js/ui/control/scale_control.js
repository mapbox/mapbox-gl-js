'use strict';

const DOM = require('../../util/dom');
const util = require('../../util/util');

/**
 * A `ScaleControl` control displays the ratio of a distance on the map to the corresponding distance on the ground.
 *
 * @implements {IControl}
 * @param {Object} [options]
 * @param {number} [options.maxWidth='150'] The maximum length of the scale control in pixels.
 * @param {string} [options.unit='metric'] Unit of the distance (`'imperial'` or `'metric'`).
 * @example
 * map.addControl(new mapboxgl.ScaleControl({
 *     maxWidth: 80,
 *     unit: 'imperial'
 * }));
 */
class ScaleControl {

    constructor(options) {
        this.options = options;

        util.bindAll([
            '_onMove'
        ], this);
    }

    getDefaultPosition() {
        return 'bottom-left';
    }

    _onMove() {
        updateScale(this._map, this._container, this.options);
    }

    onAdd(map) {
        this._map = map;
        this._container = DOM.create('div', 'mapboxgl-ctrl mapboxgl-ctrl-scale', map.getContainer());

        this._map.on('move', this._onMove);
        this._onMove();

        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map.off('move', this._onMove);
        this._map = undefined;
    }
}

module.exports = ScaleControl;

function updateScale(map, container, options) {
    // A horizontal scale is imagined to be present at center of the map
    // container with maximum length (Default) as 100px.
    // Using spherical law of cosines approximation, the real distance is
    // found between the two coordinates.
    const maxWidth = options && options.maxWidth || 100;

    const y = map._container.clientHeight / 2;
    const maxMeters = getDistance(map.unproject([0, y]), map.unproject([maxWidth, y]));
    // The real distance corresponding to 100px scale length is rounded off to
    // near pretty number and the scale length for the same is found out.
    // Default unit of the scale is based on User's locale.
    if (options && options.unit === 'imperial') {
        const maxFeet = 3.2808 * maxMeters;
        if (maxFeet > 5280) {
            const maxMiles = maxFeet / 5280;
            setScale(container, maxWidth, maxMiles, 'mi');
        } else {
            setScale(container, maxWidth, maxFeet, 'ft');
        }
    } else {
        setScale(container, maxWidth, maxMeters, 'm');
    }
}

function setScale(container, maxWidth, maxDistance, unit) {
    let distance = getRoundNum(maxDistance);
    const ratio = distance / maxDistance;

    if (unit === 'm' && distance >= 1000) {
        distance = distance / 1000;
        unit = 'km';
    }

    container.style.width = `${maxWidth * ratio}px`;
    container.innerHTML = distance + unit;
}

function getDistance(latlng1, latlng2) {
    // Uses spherical law of cosines approximation.
    const R = 6371000;

    const rad = Math.PI / 180,
        lat1 = latlng1.lat * rad,
        lat2 = latlng2.lat * rad,
        a = Math.sin(lat1) * Math.sin(lat2) +
          Math.cos(lat1) * Math.cos(lat2) * Math.cos((latlng2.lng - latlng1.lng) * rad);

    const maxMeters = R * Math.acos(Math.min(a, 1));
    return maxMeters;

}

function getRoundNum(num) {
    const pow10 = Math.pow(10, (`${Math.floor(num)}`).length - 1);
    let d = num / pow10;

    d = d >= 10 ? 10 :
        d >= 5 ? 5 :
        d >= 3 ? 3 :
        d >= 2 ? 2 : 1;

    return pow10 * d;
}
