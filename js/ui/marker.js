/* eslint-disable */
'use strict';

module.exports = Marker;

var DOM = require('../util/dom');
var util = require('../util/util');
var LngLat = require('../geo/lng_lat');
var Point = require('point-geometry');
var Popup = require('./popup');

/**
 * Creates a marker component
 * @class Marker
 * @param {HTMLElement=} element DOM element to use as a marker (creates a div element by default)
 * @param {Object=} options
 * @param {PointLike=} options.offset The offset in pixels as a [`PointLike`](#PointLike) object to apply relative to the element's top left corner. Negatives indicate left and up.
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

    this._update = this._update.bind(this);
}

Marker.prototype = {
    /**
     * Attaches the marker to a map
     * @param {Map} map
     * @returns {Marker} `this`
     */
    addTo: function (map) {
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
     * var marker = new mapboxgl.Marker().addTo(map);
     * marker.remove();
     * @returns {Marker} `this`
     */
    remove: function () {
        if (this._map) {
            this._map.off('move', this._update);
            this._map = null;
        }
        var parent = this._el.parentNode;
        if (parent) parent.removeChild(this._el);
        if (this._popup) this._closePopup();
        return this;
    },

    /**
     * Get the marker's geographical location
     * @returns {LngLat}
     */
    getLngLat: function () {
        return this._lngLat;
    },

    /**
     * Set the marker's geographical position and move it.
     * @param {LngLat} lnglat
     * @returns {Marker} `this`
     */
    setLngLat: function (lnglat) {
        this._lngLat = LngLat.convert(lnglat);
        if (this._popup) this._popup.setLngLat(this._lngLat);
        this._update();
        return this;
    },

    getElement: function () {
        return this._el;
    },

    /**
     * Binds a Popup to the Marker
     * @param {Popup=} popup an instance of the `Popup` class. If undefined or null, any popup
     * set on this `Marker` instance is unset
     * @returns {Marker} `this`
     */

    setPopup: function (popup) {
        var this = that;

        if (popup == null) {
            this._closePopup();
            delete this._popupHandlersAdded;
            delete this._popup;
        } else if (popup instanceof Popup) {
            this._popup = popup;
        } else {
            util.warnOnce('Marker.setPopup only accepts an instance of the Popup class as an argument. If no argument is provided, the popup is unset from this Marker instance');
        }

        if (this._popup && this._lngLat) this._popup.setLngLat(this._lngLat);

        if (!this._popupHandlersAdded) {
            this.getElement().addEventListener('click', function(event) {
                event.stopPropagation();
                that._openPopup();
            });
            this._popupHandlersAdded = true;
        }
        return this;
    },

    /**
     * Returns the Popup instance that is bound to the Marker
     * @returns {Popup} popup
     */
    getPopup: function () {
        return this._popup;
    },

    /**
     * Opens or closes the bound popup, depending on the current state
     * @returns {Marker} `this`
     */
    togglePopup: function () {
        if (this._popup) {
            if (this._popup._map) {
                this._closePopup();
            } else {
                this._openPopup();
            }
        }
    },

    _openPopup: function (e) {
        if (!this._popup || !this._map) return;

        if (!this._popup._map) {
            this._popup.addTo(this._map);
        }

        return this;
    },

    _closePopup: function () {
        if (this._popup) {
            this._popup.remove();
        }

        return this;
    },

    _update: function () {
        if (!this._map) return;
        var pos = this._map.project(this._lngLat)._add(this._offset);
        DOM.setTransform(this._el, 'translate(' + pos.x + 'px,' + pos.y + 'px)');
    }
};
