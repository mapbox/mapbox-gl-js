// @flow

import {Event, Evented} from '../../util/evented';
import DOM from '../../util/dom';
import window from '../../util/window';
import {extend, bindAll, warnOnce} from '../../util/util';
import assert from 'assert';
import LngLat from '../../geo/lng_lat';
import Marker from '../marker';

import type Map from '../map';
import type {AnimationOptions, CameraOptions} from '../camera';

type Options = {
    positionOptions?: PositionOptions,
    fitBoundsOptions?: AnimationOptions & CameraOptions,
    trackUserLocation?: boolean,
    showAccuracyCircle?: boolean,
    showUserLocation?: boolean
};

const defaultOptions: Options = {
    positionOptions: {
        enableHighAccuracy: false,
        maximumAge: 0,
        timeout: 6000 /* 6 sec */
    },
    fitBoundsOptions: {
        maxZoom: 15
    },
    trackUserLocation: false,
    showAccuracyCircle: true,
    showUserLocation: true
};

let supportsGeolocation;

function checkGeolocationSupport(callback) {
    if (supportsGeolocation !== undefined) {
        callback(supportsGeolocation);

    } else if (window.navigator.permissions !== undefined) {
        // navigator.permissions has incomplete browser support
        // http://caniuse.com/#feat=permissions-api
        // Test for the case where a browser disables Geolocation because of an
        // insecure origin
        window.navigator.permissions.query({name: 'geolocation'}).then((p) => {
            supportsGeolocation = p.state !== 'denied';
            callback(supportsGeolocation);
        });

    } else {
        supportsGeolocation = !!window.navigator.geolocation;
        callback(supportsGeolocation);
    }
}

let numberOfWatches = 0;
let noTimeout = false;

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
 * The zoom level applied will depend on the accuracy of the geolocation provided by the device.
 *
 * The GeolocateControl has two modes. If `trackUserLocation` is `false` (default) the control acts as a button, which when pressed will set the map's camera to target the user location. If the user moves, the map won't update. This is most suited for the desktop. If `trackUserLocation` is `true` the control acts as a toggle button that when active the user's location is actively monitored for changes. In this mode the GeolocateControl has three interaction states:
 * * active - the map's camera automatically updates as the user's location changes, keeping the location dot in the center. Initial state and upon clicking the `GeolocateControl` button.
 * * passive - the user's location dot automatically updates, but the map's camera does not. Occurs upon the user initiating a map movement.
 * * disabled - occurs if Geolocation is not available, disabled or denied.
 *
 * These interaction states can't be controlled programmatically, rather they are set based on user interactions.
 *
 * @implements {IControl}
 * @param {Object} [options]
 * @param {Object} [options.positionOptions={enableHighAccuracy: false, timeout: 6000}] A Geolocation API [PositionOptions](https://developer.mozilla.org/en-US/docs/Web/API/PositionOptions) object.
 * @param {Object} [options.fitBoundsOptions={maxZoom: 15}] A [`fitBounds`](#map#fitbounds) options object to use when the map is panned and zoomed to the user's location. The default is to use a `maxZoom` of 15 to limit how far the map will zoom in for very accurate locations.
 * @param {Object} [options.trackUserLocation=false] If `true` the Geolocate Control becomes a toggle button and when active the map will receive updates to the user's location as it changes.
 * @param {Object} [options.showAccuracyCircle=true] By default, if showUserLocation is `true`, a transparent circle will be drawn around the user location indicating the accuracy (95% confidence level) of the user's location. Set to `false` to disable. Always disabled when showUserLocation is `false`.
 * @param {Object} [options.showUserLocation=true] By default a dot will be shown on the map at the user's location. Set to `false` to disable.
 *
 * @example
 * map.addControl(new mapboxgl.GeolocateControl({
 *     positionOptions: {
 *         enableHighAccuracy: true
 *     },
 *     trackUserLocation: true
 * }));
 * @see [Locate the user](https://www.mapbox.com/mapbox-gl-js/example/locate-user/)
 */
class GeolocateControl extends Evented {
    _map: Map;
    options: Options;
    _container: HTMLElement;
    _dotElement: HTMLElement;
    _circleElement: HTMLElement;
    _geolocateButton: HTMLButtonElement;
    _geolocationWatchID: number;
    _timeoutId: ?TimeoutID;
    _watchState: 'OFF' | 'ACTIVE_LOCK' | 'WAITING_ACTIVE' | 'ACTIVE_ERROR' | 'BACKGROUND' | 'BACKGROUND_ERROR';
    _lastKnownPosition: any;
    _userLocationDotMarker: Marker;
    _accuracyCircleMarker: Marker;
    _accuracy: number;
    _setup: boolean; // set to true once the control has been setup

    constructor(options: Options) {
        super();
        this.options = extend({}, defaultOptions, options);

        bindAll([
            '_onSuccess',
            '_onError',
            '_onZoom',
            '_finish',
            '_setupUI',
            '_updateCamera',
            '_updateMarker'
        ], this);
    }

    onAdd(map: Map) {
        this._map = map;
        this._container = DOM.create('div', `mapboxgl-ctrl mapboxgl-ctrl-group`);
        checkGeolocationSupport(this._setupUI);
        return this._container;
    }

    onRemove() {
        // clear the geolocation watch if exists
        if (this._geolocationWatchID !== undefined) {
            window.navigator.geolocation.clearWatch(this._geolocationWatchID);
            this._geolocationWatchID = (undefined: any);
        }

        // clear the markers from the map
        if (this.options.showUserLocation && this._userLocationDotMarker) {
            this._userLocationDotMarker.remove();
        }
        if (this.options.showAccuracyCircle && this._accuracyCircleMarker) {
            this._accuracyCircleMarker.remove();
        }

        DOM.remove(this._container);
        this._map.off('zoom', this._onZoom);
        this._map = (undefined: any);
        numberOfWatches = 0;
        noTimeout = false;
    }

    _isOutOfMapMaxBounds(position: Position) {
        const bounds = this._map.getMaxBounds();
        const coordinates = position.coords;

        return bounds && (
            coordinates.longitude < bounds.getWest() ||
            coordinates.longitude > bounds.getEast() ||
            coordinates.latitude < bounds.getSouth() ||
            coordinates.latitude > bounds.getNorth()
        );
    }

    _setErrorState() {
        switch (this._watchState) {
        case 'WAITING_ACTIVE':
            this._watchState = 'ACTIVE_ERROR';
            this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-active');
            this._geolocateButton.classList.add('mapboxgl-ctrl-geolocate-active-error');
            break;
        case 'ACTIVE_LOCK':
            this._watchState = 'ACTIVE_ERROR';
            this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-active');
            this._geolocateButton.classList.add('mapboxgl-ctrl-geolocate-active-error');
            this._geolocateButton.classList.add('mapboxgl-ctrl-geolocate-waiting');
            // turn marker grey
            break;
        case 'BACKGROUND':
            this._watchState = 'BACKGROUND_ERROR';
            this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-background');
            this._geolocateButton.classList.add('mapboxgl-ctrl-geolocate-background-error');
            this._geolocateButton.classList.add('mapboxgl-ctrl-geolocate-waiting');
            // turn marker grey
            break;
        case 'ACTIVE_ERROR':
            break;
        default:
            assert(false, `Unexpected watchState ${this._watchState}`);
        }
    }

    _onSuccess(position: Position) {
        if (!this._map) {
            // control has since been removed
            return;
        }

        if (this._isOutOfMapMaxBounds(position)) {
            this._setErrorState();

            this.fire(new Event('outofmaxbounds', position));
            this._updateMarker();
            this._finish();

            return;
        }

        if (this.options.trackUserLocation) {
            // keep a record of the position so that if the state is BACKGROUND and the user
            // clicks the button, we can move to ACTIVE_LOCK immediately without waiting for
            // watchPosition to trigger _onSuccess
            this._lastKnownPosition = position;

            switch (this._watchState) {
            case 'WAITING_ACTIVE':
            case 'ACTIVE_LOCK':
            case 'ACTIVE_ERROR':
                this._watchState = 'ACTIVE_LOCK';
                this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-waiting');
                this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-active-error');
                this._geolocateButton.classList.add('mapboxgl-ctrl-geolocate-active');
                break;
            case 'BACKGROUND':
            case 'BACKGROUND_ERROR':
                this._watchState = 'BACKGROUND';
                this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-waiting');
                this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-background-error');
                this._geolocateButton.classList.add('mapboxgl-ctrl-geolocate-background');
                break;
            default:
                assert(false, `Unexpected watchState ${this._watchState}`);
            }
        }

        // if showUserLocation and the watch state isn't off then update the marker location
        if (this.options.showUserLocation && this._watchState !== 'OFF') {
            this._updateMarker(position);
        }

        // if in normal mode (not watch mode), or if in watch mode and the state is active watch
        // then update the camera
        if (!this.options.trackUserLocation || this._watchState === 'ACTIVE_LOCK') {
            this._updateCamera(position);
        }

        if (this.options.showUserLocation) {
            this._dotElement.classList.remove('mapboxgl-user-location-dot-stale');
        }

        this.fire(new Event('geolocate', position));
        this._finish();
    }

    _updateCamera(position: Position) {
        const center = new LngLat(position.coords.longitude, position.coords.latitude);
        const radius = position.coords.accuracy;
        const bearing = this._map.getBearing();
        const options = extend({bearing}, this.options.fitBoundsOptions);

        this._map.fitBounds(center.toBounds(radius), options, {
            geolocateSource: true // tag this camera change so it won't cause the control to change to background state
        });
    }

    _updateMarker(position: ?Position) {
        if (position) {
            const center = new LngLat(position.coords.longitude, position.coords.latitude);
            this._accuracyCircleMarker.setLngLat(center).addTo(this._map);
            this._userLocationDotMarker.setLngLat(center).addTo(this._map);
            this._accuracy = position.coords.accuracy;
            if (this.options.showUserLocation && this.options.showAccuracyCircle) {
                this._updateCircleRadius();
            }
        } else {
            this._userLocationDotMarker.remove();
            this._accuracyCircleMarker.remove();
        }
    }

    _updateCircleRadius() {
        assert(this._circleElement);
        const y = this._map._container.clientHeight / 2;
        const a = this._map.unproject([0, y]);
        const b = this._map.unproject([1, y]);
        const metersPerPixel = a.distanceTo(b);
        const circleDiameter = Math.ceil(2.0 * this._accuracy / metersPerPixel);
        this._circleElement.style.width = `${circleDiameter}px`;
        this._circleElement.style.height = `${circleDiameter}px`;
    }

    _onZoom() {
        if (this.options.showUserLocation && this.options.showAccuracyCircle) {
            this._updateCircleRadius();
        }
    }

    _onError(error: PositionError) {
        if (!this._map) {
            // control has since been removed
            return;
        }

        if (this.options.trackUserLocation) {
            if (error.code === 1) {
                // PERMISSION_DENIED
                this._watchState = 'OFF';
                this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-waiting');
                this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-active');
                this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-active-error');
                this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-background');
                this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-background-error');
                this._geolocateButton.disabled = true;
                const title = this._map._getUIString('GeolocateControl.LocationNotAvailable');
                this._geolocateButton.title = title;
                this._geolocateButton.setAttribute('aria-label', title);

                if (this._geolocationWatchID !== undefined) {
                    this._clearWatch();
                }
            } else if (error.code === 3 && noTimeout) {
                // this represents a forced error state
                // this was triggered to force immediate geolocation when a watch is already present
                // see https://github.com/mapbox/mapbox-gl-js/issues/8214
                // and https://w3c.github.io/geolocation-api/#example-5-forcing-the-user-agent-to-return-a-fresh-cached-position
                return;
            } else {
                this._setErrorState();
            }
        }

        if (this._watchState !== 'OFF' && this.options.showUserLocation) {
            this._dotElement.classList.add('mapboxgl-user-location-dot-stale');
        }

        this.fire(new Event('error', error));

        this._finish();
    }

    _finish() {
        if (this._timeoutId) { clearTimeout(this._timeoutId); }
        this._timeoutId = undefined;
    }

    _setupUI(supported: boolean) {
        this._container.addEventListener('contextmenu', (e: MouseEvent) => e.preventDefault());
        this._geolocateButton = DOM.create('button', `mapboxgl-ctrl-geolocate`, this._container);
        DOM.create('span', `mapboxgl-ctrl-icon`, this._geolocateButton).setAttribute('aria-hidden', true);
        this._geolocateButton.type = 'button';

        if (supported === false) {
            warnOnce('Geolocation support is not available so the GeolocateControl will be disabled.');
            const title = this._map._getUIString('GeolocateControl.LocationNotAvailable');
            this._geolocateButton.disabled = true;
            this._geolocateButton.title = title;
            this._geolocateButton.setAttribute('aria-label', title);
        } else {
            const title = this._map._getUIString('GeolocateControl.FindMyLocation');
            this._geolocateButton.title = title;
            this._geolocateButton.setAttribute('aria-label', title);
        }

        if (this.options.trackUserLocation) {
            this._geolocateButton.setAttribute('aria-pressed', 'false');
            this._watchState = 'OFF';
        }

        // when showUserLocation is enabled, keep the Geolocate button disabled until the device location marker is setup on the map
        if (this.options.showUserLocation) {
            this._dotElement = DOM.create('div', 'mapboxgl-user-location-dot');

            this._userLocationDotMarker = new Marker(this._dotElement);

            this._circleElement = DOM.create('div', 'mapboxgl-user-location-accuracy-circle');
            this._accuracyCircleMarker = new Marker({element: this._circleElement, pitchAlignment: 'map'});

            if (this.options.trackUserLocation) this._watchState = 'OFF';

            this._map.on('zoom', this._onZoom);
        }

        this._geolocateButton.addEventListener('click',
            this.trigger.bind(this));

        this._setup = true;

        // when the camera is changed (and it's not as a result of the Geolocation Control) change
        // the watch mode to background watch, so that the marker is updated but not the camera.
        if (this.options.trackUserLocation) {
            this._map.on('movestart', (event) => {
                const fromResize = event.originalEvent && event.originalEvent.type === 'resize';
                if (!event.geolocateSource && this._watchState === 'ACTIVE_LOCK' && !fromResize) {
                    this._watchState = 'BACKGROUND';
                    this._geolocateButton.classList.add('mapboxgl-ctrl-geolocate-background');
                    this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-active');

                    this.fire(new Event('trackuserlocationend'));
                }
            });
        }
    }

    /**
    * Programmatically request and move the map to the user's location.
    *
    * @returns {boolean} Returns `false` if called before control was added to a map, otherwise returns `true`.
    * @example
    * // Initialize the geolocate control.
    * var geolocate = new mapboxgl.GeolocateControl({
    *  positionOptions: {
    *    enableHighAccuracy: true
    *  },
    *  trackUserLocation: true
    * });
    * // Add the control to the map.
    * map.addControl(geolocate);
    * map.on('load', function() {
    *   geolocate.trigger();
    * });
    */
    trigger() {
        if (!this._setup) {
            warnOnce('Geolocate control triggered before added to a map');
            return false;
        }
        if (this.options.trackUserLocation) {
            // update watchState and do any outgoing state cleanup
            switch (this._watchState) {
            case 'OFF':
                // turn on the Geolocate Control
                this._watchState = 'WAITING_ACTIVE';

                this.fire(new Event('trackuserlocationstart'));
                break;
            case 'WAITING_ACTIVE':
            case 'ACTIVE_LOCK':
            case 'ACTIVE_ERROR':
            case 'BACKGROUND_ERROR':
                // turn off the Geolocate Control
                numberOfWatches--;
                noTimeout = false;
                this._watchState = 'OFF';
                this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-waiting');
                this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-active');
                this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-active-error');
                this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-background');
                this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-background-error');

                this.fire(new Event('trackuserlocationend'));
                break;
            case 'BACKGROUND':
                this._watchState = 'ACTIVE_LOCK';
                this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-background');
                // set camera to last known location
                if (this._lastKnownPosition) this._updateCamera(this._lastKnownPosition);

                this.fire(new Event('trackuserlocationstart'));
                break;
            default:
                assert(false, `Unexpected watchState ${this._watchState}`);
            }

            // incoming state setup
            switch (this._watchState) {
            case 'WAITING_ACTIVE':
                this._geolocateButton.classList.add('mapboxgl-ctrl-geolocate-waiting');
                this._geolocateButton.classList.add('mapboxgl-ctrl-geolocate-active');
                break;
            case 'ACTIVE_LOCK':
                this._geolocateButton.classList.add('mapboxgl-ctrl-geolocate-active');
                break;
            case 'ACTIVE_ERROR':
                this._geolocateButton.classList.add('mapboxgl-ctrl-geolocate-waiting');
                this._geolocateButton.classList.add('mapboxgl-ctrl-geolocate-active-error');
                break;
            case 'BACKGROUND':
                this._geolocateButton.classList.add('mapboxgl-ctrl-geolocate-background');
                break;
            case 'BACKGROUND_ERROR':
                this._geolocateButton.classList.add('mapboxgl-ctrl-geolocate-waiting');
                this._geolocateButton.classList.add('mapboxgl-ctrl-geolocate-background-error');
                break;
            case 'OFF':
                break;
            default:
                assert(false, `Unexpected watchState ${this._watchState}`);
            }

            // manage geolocation.watchPosition / geolocation.clearWatch
            if (this._watchState === 'OFF' && this._geolocationWatchID !== undefined) {
                // clear watchPosition as we've changed to an OFF state
                this._clearWatch();
            } else if (this._geolocationWatchID === undefined) {
                // enable watchPosition since watchState is not OFF and there is no watchPosition already running

                this._geolocateButton.classList.add('mapboxgl-ctrl-geolocate-waiting');
                this._geolocateButton.setAttribute('aria-pressed', 'true');

                numberOfWatches++;
                let positionOptions;
                if (numberOfWatches > 1) {
                    positionOptions = {maximumAge:600000, timeout:0};
                    noTimeout = true;
                } else {
                    positionOptions = this.options.positionOptions;
                    noTimeout = false;
                }

                this._geolocationWatchID = window.navigator.geolocation.watchPosition(
                    this._onSuccess, this._onError, positionOptions);
            }
        } else {
            window.navigator.geolocation.getCurrentPosition(
                this._onSuccess, this._onError, this.options.positionOptions);

            // This timeout ensures that we still call finish() even if
            // the user declines to share their location in Firefox
            this._timeoutId = setTimeout(this._finish, 10000 /* 10sec */);
        }

        return true;
    }

    _clearWatch() {
        window.navigator.geolocation.clearWatch(this._geolocationWatchID);

        this._geolocationWatchID = (undefined: any);
        this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-waiting');
        this._geolocateButton.setAttribute('aria-pressed', 'false');

        if (this.options.showUserLocation) {
            this._updateMarker(null);
        }
    }
}

export default GeolocateControl;

/* Geolocate Control Watch States
 * This is the private state of the control.
 *
 * OFF
 *    off/inactive
 * WAITING_ACTIVE
 *    Geolocate Control was clicked but still waiting for Geolocation API response with user location
 * ACTIVE_LOCK
 *    Showing the user location as a dot AND tracking the camera to be fixed to their location. If their location changes the map moves to follow.
 * ACTIVE_ERROR
 *    There was en error from the Geolocation API while trying to show and track the user location.
 * BACKGROUND
 *    Showing the user location as a dot but the camera doesn't follow their location as it changes.
 * BACKGROUND_ERROR
 *    There was an error from the Geolocation API while trying to show (but not track) the user location.
 */

/**
 * Fired on each Geolocation API position update which returned as success.
 *
 * @event geolocate
 * @memberof GeolocateControl
 * @instance
 * @property {Position} data The returned [Position](https://developer.mozilla.org/en-US/docs/Web/API/Position) object from the callback in [Geolocation.getCurrentPosition()](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition) or [Geolocation.watchPosition()](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition).
 * @example
 * // Initialize the geolocate control.
 * var geolocate = new mapboxgl.GeolocateControl({
 *   positionOptions: {
 *       enableHighAccuracy: true
 *   },
 *   trackUserLocation: true
 * });
 * // Add the control to the map.
 * map.addControl(geolocate);
 * // Set an event listener that fires
 * // when a geolocate event occurs.
 * geolocate.on('geolocate', function() {
 *   console.log('A geolocate event has occurred.')
 * });
 *
 */

/**
 * Fired on each Geolocation API position update which returned as an error.
 *
 * @event error
 * @memberof GeolocateControl
 * @instance
 * @property {PositionError} data The returned [PositionError](https://developer.mozilla.org/en-US/docs/Web/API/PositionError) object from the callback in [Geolocation.getCurrentPosition()](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition) or [Geolocation.watchPosition()](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition).
 * @example
 * // Initialize the geolocate control.
 * var geolocate = new mapboxgl.GeolocateControl({
 *   positionOptions: {
 *       enableHighAccuracy: true
 *   },
 *   trackUserLocation: true
 * });
 * // Add the control to the map.
 * map.addControl(geolocate);
 * // Set an event listener that fires
 * // when an error event occurs.
 * geolocate.on('error', function() {
 *   console.log('An error event has occurred.')
 * });
 *
 */

/**
 * Fired on each Geolocation API position update which returned as success but user position is out of map maxBounds.
 *
 * @event outofmaxbounds
 * @memberof GeolocateControl
 * @instance
 * @property {Position} data The returned [Position](https://developer.mozilla.org/en-US/docs/Web/API/Position) object from the callback in [Geolocation.getCurrentPosition()](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition) or [Geolocation.watchPosition()](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition).
 * @example
 * // Initialize the geolocate control.
 * var geolocate = new mapboxgl.GeolocateControl({
 *   positionOptions: {
 *       enableHighAccuracy: true
 *   },
 *   trackUserLocation: true
 * });
 * // Add the control to the map.
 * map.addControl(geolocate);
 * // Set an event listener that fires
 * // when an outofmaxbounds event occurs.
 * geolocate.on('outofmaxbounds', function() {
 *   console.log('An outofmaxbounds event has occurred.')
 * });
 *
 */

/**
 * Fired when the Geolocate Control changes to the active lock state, which happens either upon first obtaining a successful Geolocation API position for the user (a geolocate event will follow), or the user clicks the geolocate button when in the background state which uses the last known position to recenter the map and enter active lock state (no geolocate event will follow unless the users's location changes).
 *
 * @event trackuserlocationstart
 * @memberof GeolocateControl
 * @instance
 * @example
 * // Initialize the geolocate control.
 * var geolocate = new mapboxgl.GeolocateControl({
 *   positionOptions: {
 *       enableHighAccuracy: true
 *   },
 *   trackUserLocation: true
 * });
 * // Add the control to the map.
 * map.addControl(geolocate);
 * // Set an event listener that fires
 * // when a trackuserlocationstart event occurs.
 * geolocate.on('trackuserlocationstart', function() {
 *   console.log('A trackuserlocationstart event has occurred.')
 * });
 *
 */

/**
 * Fired when the Geolocate Control changes to the background state, which happens when a user changes the camera during an active position lock. This only applies when trackUserLocation is true. In the background state, the dot on the map will update with location updates but the camera will not.
 *
 * @event trackuserlocationend
 * @memberof GeolocateControl
 * @instance
 * @example
 * // Initialize the geolocate control.
 * var geolocate = new mapboxgl.GeolocateControl({
 *   positionOptions: {
 *       enableHighAccuracy: true
 *   },
 *   trackUserLocation: true
 * });
 * // Add the control to the map.
 * map.addControl(geolocate);
 * // Set an event listener that fires
 * // when a trackuserlocationend event occurs.
 * geolocate.on('trackuserlocationend', function() {
 *   console.log('A trackuserlocationend event has occurred.')
 * });
 *
 */
