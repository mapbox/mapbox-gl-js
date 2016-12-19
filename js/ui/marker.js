'use strict';

const DOM = require('../util/dom');
const LngLat = require('../geo/lng_lat');
const Point = require('point-geometry');

/**
 * Creates a marker component
 * @param {HTMLElement=} element DOM element to use as a marker (creates a div element by default)
 * @param {Object=} options
 * @param {PointLike=} options.offset The offset in pixels as a [`PointLike`](#PointLike) object to apply relative to the element's top left corner. Negatives indicate left and up.
 * @example
 * var marker = new mapboxgl.Marker()
 *   .setLngLat([30.5, 50.5])
 *   .addTo(map);
 * @see [Add custom icons with Markers](https://www.mapbox.com/mapbox-gl-js/example/custom-marker-icons/)
 */
class Marker {

    constructor(element, options) {
        this._offset = Point.convert(options && options.offset || [0, 0]);

        this._update = this._update.bind(this);
        this._onMapClick = this._onMapClick.bind(this);

        if (!element) element = DOM.create('div');
        element.classList.add('mapboxgl-marker');
        this._element = element;

        this._popup = null;
    }

    /**
     * Attaches the marker to a map
     * @param {Map} map
     * @returns {Marker} `this`
     */
    addTo(map) {
        this.remove();
        this._map = map;
        map.getCanvasContainer().appendChild(this._element);
        map.on('move', this._update);
        map.on('moveend', this._update);
        this._update();

        // If we attached the `click` listener to the marker element, the popup
        // would close once the event propogated to `map` due to the
        // `Popup#_onClickClose` listener.
        this._map.on('click', this._onMapClick);

        return this;
    }

    /**
     * Removes the marker from a map
     * @example
     * var marker = new mapboxgl.Marker().addTo(map);
     * marker.remove();
     * @returns {Marker} `this`
     */
    remove() {
        if (this._map) {
            this._map.off('click', this._onMapClick);
            this._map.off('move', this._update);
            this._map.off('moveend', this._update);
            this._map = null;
        }
        DOM.remove(this._element);
        if (this._popup) this._popup.remove();
        return this;
    }

    /**
     * Get the marker's geographical location
     * @returns {LngLat}
     */
    getLngLat() {
        return this._lngLat;
    }

    /**
     * Set the marker's geographical position and move it.
     * @param {LngLat} lnglat
     * @returns {Marker} `this`
     */
    setLngLat(lnglat) {
        this._lngLat = LngLat.convert(lnglat);
        if (this._popup) this._popup.setLngLat(this._lngLat);
        this._update();
        return this;
    }

    getElement() {
        return this._element;
    }

    /**
     * Binds a Popup to the Marker
     * @param {Popup=} popup an instance of the `Popup` class. If undefined or null, any popup
     * set on this `Marker` instance is unset
     * @returns {Marker} `this`
     */

    setPopup(popup) {
        if (this._popup) {
            this._popup.remove();
            this._popup = null;
        }

        if (popup) {
            this._popup = popup;
            this._popup.setLngLat(this._lngLat);
        }

        return this;
    }

    _onMapClick(event) {
        const targetElement = event.originalEvent.target;
        const element = this._element;

        if (this._popup && (targetElement === element || element.contains(targetElement))) {
            this.togglePopup();
        }
    }

    /**
     * Returns the Popup instance that is bound to the Marker
     * @returns {Popup} popup
     */
    getPopup() {
        return this._popup;
    }

    /**
     * Opens or closes the bound popup, depending on the current state
     * @returns {Marker} `this`
     */
    togglePopup() {
        const popup = this._popup;

        if (!popup) return;
        else if (popup.isOpen()) popup.remove();
        else popup.addTo(this._map);
    }

    _update(e) {
        if (!this._map) return;
        let pos = this._map.project(this._lngLat)._add(this._offset);
        // because rouding the coordinates at every `move` event causes stuttered zooming
        // we only round them when _update is called with `moveend` or when its called with
        // no arguments (when the Marker is initialized or Marker#setLngLat is invoked).
        if (!e || e.type === "moveend") pos = pos.round();
        DOM.setTransform(this._element, `translate(${pos.x}px, ${pos.y}px)`);
    }
}

module.exports = Marker;
