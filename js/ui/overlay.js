/* eslint-disable */
'use strict';

module.exports = Overlay;

var DOM = require('../util/dom');
var LngLat = require('../geo/lng_lat');

/**
 * Creates an overlay component
 * @class Overlay
 * @param {HTMLElement=} element DOM element to use as an overlay (creates a div element by default)
 * @example
 * var overlay = new mapboxgl.Overlay()
 *   .setLngLat([30.5, 50.5])
 *   .addTo(map);
 */
function Overlay(element) {
    if (!element) {
        element = DOM.create('div');
    }
    element.classList.add('mapboxgl-overlay');
    this._el = element;
    this._update = this._update.bind(this);
}

Overlay.prototype = /** @lends Overlay.prototype */{
    /**
     * Attaches the overlay to a map
     * @param {Map} map
     * @returns {Overlay} `this`
     */
    addTo: function(map) {
        this.remove();
        this._map = map;
        map.getCanvasContainer().appendChild(this._el);
        map.on('move', this._update);
        this._update();
        return this;
    },

    /**
     * Removes the overlay from a map
     * @example
     * var overlay = new mapboxgl.Overlay().addTo(map);
     * overlay.remove();
     * @returns {Overlay} `this`
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
     * Get the overlay's geographical location
     * @returns {LngLat}
     */
    getLngLat: function() {
        return this._lngLat;
    },

    /**
     * Set the overlay's geographical position and move it.
     * @param {LngLat} lnglat
     * @returns {Popup} `this`
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
        var pos = this._map.project(this._lngLat);
        DOM.setTransform(this._el, 'translate(' + pos.x + 'px,' + pos.y + 'px)');
    }
};
