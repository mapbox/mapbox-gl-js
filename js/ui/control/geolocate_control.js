'use strict';

const Control = require('./control');
const browser = require('../../util/browser');
const DOM = require('../../util/dom');
const window = require('../../util/window');

const geoOptions = { enableHighAccuracy: false, timeout: 6000 /* 6sec */ };

/**
 * A `GeolocateControl` control provides a button that uses the browser's geolocation
 * API to locate the user on the map.
 *
 * @param {Object} [options]
 * @param {string} [options.position='top-right'] A string indicating the control's position on the map. Options are `'top-right'`, `'top-left'`, `'bottom-right'`, and `'bottom-left'`.
 * @example
 * map.addControl(new mapboxgl.GeolocateControl({position: 'top-left'})); // position is optional
 */
class GeolocateControl extends Control {

    constructor(options) {
        super();
        this._position = options && options.position || 'top-right';
    }

    onAdd(map) {
        const className = 'mapboxgl-ctrl';

        const container = this._container = DOM.create('div', `${className}-group`, map.getContainer());
        if (!browser.supportsGeolocation) return container;

        this._container.addEventListener('contextmenu', (e) => e.preventDefault());

        this._geolocateButton = DOM.create('button', (`${className}-icon ${className}-geolocate`), this._container);
        this._geolocateButton.type = 'button';
        this._geolocateButton.setAttribute('aria-label', 'Geolocate');
        this._geolocateButton.addEventListener('click', this._onClickGeolocate.bind(this));
        return container;
    }

    _onClickGeolocate() {
        window.navigator.geolocation.getCurrentPosition(this._success.bind(this), this._error.bind(this), geoOptions);

        // This timeout ensures that we still call finish() even if
        // the user declines to share their location in Firefox
        this._timeoutId = setTimeout(this._finish.bind(this), 10000 /* 10sec */);
    }

    _success(position) {
        this._map.jumpTo({
            center: [position.coords.longitude, position.coords.latitude],
            zoom: 17,
            bearing: 0,
            pitch: 0
        });

        this.fire('geolocate', position);
        this._finish();
    }

    _error(error) {
        this.fire('error', error);
        this._finish();
    }

    _finish() {
        if (this._timeoutId) { clearTimeout(this._timeoutId); }
        this._timeoutId = undefined;
    }
}

module.exports = GeolocateControl;

/**
 * geolocate event.
 *
 * @event geolocate
 * @memberof GeolocateControl
 * @instance
 * @property {Position} data The returned [Position](https://developer.mozilla.org/en-US/docs/Web/API/Position) object from the callback in [Geolocation.getCurrentPosition()](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition).
 *
 */

/**
 * error event.
 *
 * @event error
 * @memberof GeolocateControl
 * @instance
 * @property {PositionError} data The returned [PositionError](https://developer.mozilla.org/en-US/docs/Web/API/PositionError) object from the callback in [Geolocation.getCurrentPosition()](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition).
 *
 */
