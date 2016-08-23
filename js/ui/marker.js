/* eslint-disable */
'use strict';

module.exports = Marker;

var DOM = require('../util/dom');
var util = require('../util/util');
var Evented = require('../util/evented');
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

Marker.prototype = util.inherit(Evented, {
    /**
     * Attaches the marker to a map
     * @param {Map} map
     * @returns {Marker} `this`
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
        if (this._popup) this._closePopup();
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
        if (this._popup) this._popup.setLngLat(this._lngLat);
        this._update();
        return this;
    },

    getElement: function() {
        return this._el;
    },

    /**
     * Binds a Popup to the Marker
     * @param {HTMLElement|String|Popup} content the DOM content to appear in the popup, or 
     *  an instance of the Popup class
     * @param {Object} [options] options for the Popup class
     * @param {boolean} [options.closeButton=true] If `true`, a close button will appear in the
     *   top right corner of the popup.
     * @param {boolean} [options.closeOnClick=true] If `true`, the popup will closed when the
     *   map is clicked.
     * @param {string} options.anchor - A string indicating the popup's location relative to
     *   the coordinate set via [Popup#setLngLat](#Popup#setLngLat).
     *   Options are `'top'`, `'bottom'`, `'left'`, `'right'`, `'top-left'`,
     * `'top-right'`, `'bottom-left'`, and `'bottom-right'`.
     * @returns {Marker} `this`
     */

    bindPopup: function(content, options){
        if (content instanceof Popup) {
            this._popup = content;
        } else {
            if (!this._popup || options) {
                this._popup = new Popup(options);
            }
            content instanceof HTMLElement ? this._popup.setDOMContent(content) : this._popup.setHTML(content);
        }
            
        if (this._popup && this._lngLat) this._popup.setLngLat(this._lngLat);

        if (!this._popupHandlersAdded) {
            this.getElement().addEventListener('click', this._openPopup.bind(this));
            this._popupHandlersAdded = true;
        }
        return this;
    },

    /**
     * Opens or closes the bound popup, depending on the current state
     * @returns {Marker} `this`
     */
    togglePopup: function(){
        if (this._popup) {
            if (this._popup._map){
                this._closePopup();
            } else {
                this._openPopup();
            }
        }
    },

    /**
     * Returns the Popup instance that is bound to the Marker
     * @returns {Popup} popup
     */
    getPopup: function(){
        if (this._popup) {
            return this._popup;
        }
    },

    _openPopup: function(e) {
        // prevent event from bubbling up to the map canvas
        // e.stopPropagation();
        if (!this._popup || !this._map) return;

        if (!this._popup._map) {
            this._popup.addTo(this._map);
        }

        return this;
    },

    _closePopup: function(){
        if (this._popup) {
            this._popup.remove();
        }

        return this;
    },

    _update: function() {
        if (!this._map) return;
        var pos = this._map.project(this._lngLat)._add(this._offset);
        DOM.setTransform(this._el, 'translate(' + pos.x + 'px,' + pos.y + 'px)');
    }
});
