/* eslint-disable */
'use strict';

module.exports = Marker;

var DOM = require('../util/dom');
var LngLat = require('../geo/lng_lat');
var Point = require('point-geometry');

/**
 * Creates a marker component
 * @class Marker
 * @param {HTMLElement=} element DOM element to use as a marker (creates a div element by default)
 * @param {Object=} options
 * @param {PointLike=} options.offset The offset in pixels as a [`PointLike`](#PointLike) object to apply relative to the element's top left corner. Negatives indicate left and up.
 * @param {boolean=} [options.perspective=false] Whether the marker should scale along with the map geometry.
 * @example
 * var marker = new mapboxgl.Marker()
 *   .setLngLat([30.5, 50.5])
 *   .addTo(map);
 */
function Marker(element, options) {
    if (!element) {
        element = DOM.create('div');
    }
    element.classList.add('mapboxgl-marker');
    this._el = element;

    this._offset = Point.convert(options && options.offset || [0, 0]);
    this._perspective = options && options.perspective || false;

    this._update = this._update.bind(this);
}

Marker.prototype = {
    /**
     * Attaches the marker to a map
     * @param {Map} map
     * @returns {Marker} `this`
     */
    addTo: function(map) {
        this.remove();
        this._map = map;
        this._startZoom = map.getZoom();
        map.getCanvasContainer().appendChild(this._el);
        map.on('move', this._update);
        this._update();
        return this;
    },

    /**
     * Removes the marker from a map
     * @example
     * var marker = new mapboxgl.Marker().addTo(map);
     * marker.remove();
     * @returns {Marker} `this`
     */
    remove: function() {
        if (this._map) {
            this._map.off('move', this._update);
            this._map = null;
        }
        var parent = this._el.parentNode;
        if (parent) parent.removeChild(this._el);
        return this;
    },

    /**
     * Get the marker's geographical location
     * @returns {LngLat}
     */
    getLngLat: function() {
        return this._lngLat;
    },

    /**
     * Set the marker's geographical position and move it.
     * @param {LngLat} lnglat
     * @returns {Marker} `this`
     */
    setLngLat: function(lnglat) {
        this._lngLat = LngLat.convert(lnglat);
        this._update();
        return this;
    },

    getElement: function() {
        return this._el;
    },

    _update: function() {
        if (!this._map) return;

        var projection = this._map.project3d(this._lngLat);
        var point = new Point(projection[0] / projection[3], projection[1] / projection[3]);
        var pos = point._add(this._offset);

        var t = 'translate3d(' + pos.x + 'px,' + pos.y + 'px,' + pos.y + 'px)';

        var scale = 1;
        if(this._perspective) {
            scale = this._map.transform._altitude/projection[3]; // adjust scale based on pitch+bearing
            scale *= Math.pow(1.6, this._map.getZoom()-this._startZoom); // adjust scale based on map zoom

             t += 'scale(' + scale + ',' + scale + ')';
        }

        DOM.setTransform(this._el, t);
    },
};
