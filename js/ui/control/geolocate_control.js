'use strict';

const Evented = require('../../util/evented');
const DOM = require('../../util/dom');
const window = require('../../util/window');
const util = require('../../util/util');

const defaultGeoPositionOptions = { enableHighAccuracy: false, timeout: 6000 /* 6sec */ };
const className = 'mapboxgl-ctrl';

let supportsGeolocation;

function checkGeolocationSupport(callback) {
    if (supportsGeolocation !== undefined) {
        callback(supportsGeolocation);

    } else if (window.navigator.permissions !== undefined) {
        // navigator.permissions has incomplete browser support
        // http://caniuse.com/#feat=permissions-api
        // Test for the case where a browser disables Geolocation because of an
        // insecure origin
        window.navigator.permissions.query({ name: 'geolocation' }).then((p) => {
            supportsGeolocation = p.state !== 'denied';
            callback(supportsGeolocation);
        });

    } else {
        supportsGeolocation = !!window.navigator.geolocation;
        callback(supportsGeolocation);
    }
}

/**
 * A `GeolocateControl` control provides a button that uses the browser's geolocation
 * API to locate the user on the map.
 *
 * Not all browsers support geolocation,
 * and some users may disable the feature. Geolocation support for modern
 * browsers including Chrome requires sites to be served over HTTPS. If
 * geolocation support is not available, the GeolocateControl will not
 * be visible.
 *
 * @implements {IControl}
 * @param {Object} [options]
 * @param {Object} [options.positionOptions={enableHighAccuracy: false, timeout: 6000}] A [PositionOptions](https://developer.mozilla.org/en-US/docs/Web/API/PositionOptions) object.
 * @param {Object} [options.watchPosition=false] If `true` the map will reposition each time the position of the device changes and the control becomes a toggle.
 * @example
 * map.addControl(new mapboxgl.GeolocateControl({
 *     positionOptions: {
 *         enableHighAccuracy: true
 *     }
 * }));
 */
class GeolocateControl extends Evented {

    constructor(options) {
        super();
        this.options = options || {};
        util.bindAll([
            '_onSuccess',
            '_onError',
            '_finish',
            '_setupUI'
        ], this);
    }

    onAdd(map) {
        this._map = map;
        this._container = DOM.create('div', `${className} ${className}-group`);
        checkGeolocationSupport(this._setupUI);
        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }

    _onSuccess(position) {
        this._map.jumpTo({
            center: [position.coords.longitude, position.coords.latitude],
            zoom: 17,
            bearing: 0,
            pitch: 0
        });

        this.fire('geolocate', position);
        this._finish();
    }

    _onError(error) {
        this.fire('error', error);
        this._finish();
    }

    _finish() {
        if (this._timeoutId) { clearTimeout(this._timeoutId); }
        this._timeoutId = undefined;
    }

    _setupUI(supported) {
        if (supported === false) return;
        this._container.addEventListener('contextmenu',
            e => e.preventDefault());
        this._geolocateButton = DOM.create('button',
            `${className}-icon ${className}-geolocate`,
            this._container);
        this._geolocateButton.type = 'button';
        this._geolocateButton.setAttribute('aria-label', 'Geolocate');
        if (this.options.watchPosition) this._geolocateButton.setAttribute('aria-pressed', false);
        this._geolocateButton.addEventListener('click',
            this._onClickGeolocate.bind(this));
    }

    _onClickGeolocate() {
        const positionOptions = util.extend(defaultGeoPositionOptions, this.options && this.options.positionOptions || {});

        // toggle watching the device location
        if (this.options.watchPosition) {
            if (this._geolocationWatchID !== undefined) {
                // clear watchPosition
                this._geolocateButton.classList.remove('watching');
                this._geolocateButton.setAttribute('aria-pressed', false);
                window.navigator.geolocation.clearWatch(this._geolocationWatchID);
                this._geolocationWatchID = undefined;
            } else {
                // enable watchPosition
                this._geolocateButton.classList.add('watching');
                this._geolocateButton.setAttribute('aria-pressed', true);
                this._geolocationWatchID = window.navigator.geolocation.watchPosition(
                    this._onSuccess, this._onError, positionOptions);
            }
        } else {
            window.navigator.geolocation.getCurrentPosition(
                this._onSuccess, this._onError, positionOptions);

            // This timeout ensures that we still call finish() even if
            // the user declines to share their location in Firefox
            this._timeoutId = setTimeout(this._finish, 10000 /* 10sec */);
        }
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
