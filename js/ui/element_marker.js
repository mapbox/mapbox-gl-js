/* eslint-disable */
'use strict';

module.exports = ElementMarker;

var DOM = require('../util/dom');
var LngLat = require('../geo/lng_lat');

/**
 * Creates a marker component
 * @class ElementMarker
 * @param {HTMLElement=} element DOM element to use as a marker (creates a div element by default)
 * @example
 * var marker = new mapboxgl.ElementMarker()
 *   .setLngLat([30.5, 50.5])
 *   .addTo(map);
 */
function ElementMarker(element) {
    if (!element) {
        element = DOM.create('div');
    }
    element.classList.add('mapboxgl-marker');
    this._el = element;
    this._update = this._update.bind(this);
}

ElementMarker.prototype = {
    /**
     * Attaches the marker to a map
     * @param {Map} map
     * @returns {ElementMarker} `this`
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
     * Removes the marker from a map
     * @example
     * var marker = new mapboxgl.ElementMarker().addTo(map);
     * marker.remove();
     * @returns {ElementMarker} `this`
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
