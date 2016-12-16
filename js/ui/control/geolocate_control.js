'use strict';

const Evented = require('../../util/evented');
const DOM = require('../../util/dom');
const window = require('../../util/window');
const util = require('../../util/util');
const assert = require('assert');

const defaultGeoPositionOptions = { enableHighAccuracy: false, timeout: 6000 /* 6sec */ };
const className = 'mapboxgl-ctrl';

const markerLayerName = '_geolocate-control-marker';
const markerShadowLayerName = '_geolocate-control-marker-shadow';
const markerSourceName = '_geolocate-control-marker-position';

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
 * The GeolocateControl has two modes. If `watchPosition` is `false` (default) the control acts as a button, which when pressed will set the map's camera to target the device location. If the device moves, the map won't update. This is most suited for the desktop. If `watchPosition` is `true` the control acts as a toggle button that when active the device's location is actively monitored for changes. In this mode there is a concept of an active lock and background. In active lock the map's camera will automatically update as the device's location changes until the user manually changes the camera (such as panning or zooming). When this happens the control is in background so that the location marker still updates but the camera doesn't.
 *
 * @implements {IControl}
 * @param {Object} [options]
 * @param {Object} [options.positionOptions={enableHighAccuracy: false, timeout: 6000}] A [PositionOptions](https://developer.mozilla.org/en-US/docs/Web/API/PositionOptions) object.
 * @param {Object} [options.watchPosition=false] If `true` the Geolocate Control becomes a toggle button and when active the map will receive updates to the device location as it changes.
 * @param {Object} [options.showMarker=true] By default a marker will be added to the map with the device's location. Set to `false` to disable.
 * @param {Object} [options.markerPaintProperties={'circle-radius': 10, 'circle-color': '#33b5e5', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2}] A [Circle Layer Paint Properties](https://www.mapbox.com/mapbox-gl-style-spec/#paint_circle) object to customize the device location marker. The default is a blue dot with a white stroke.
 * @param {Object} [options.markerShadowPaintProperties={ 'circle-radius': 14, 'circle-color': '#000', 'circle-opacity': 0.5, 'circle-blur': 0.4, 'circle-translate': [2, 2], 'circle-translate-anchor': 'viewport' }] A [Circle Layer Paint Properties](https://www.mapbox.com/mapbox-gl-style-spec/#paint_circle) object to customize the device location marker, used as a "shadow" layer. The default is a blurred semi-transparent black shadow.
 * @param {Object} [options.markerStalePaintProperties={'circle-color': '#a6d5e5', 'circle-opacity': 0.5, 'circle-stroke-opacity': 0.8}] A [Circle Layer Paint Properties](https://www.mapbox.com/mapbox-gl-style-spec/#paint_circle) object applied to the base markerPaintProperties to customize the device location marker in a stale state. The marker is stale when there was a Geolocation error so the previous reported location is used, which may no longer be current. The default is a faded blue dot with a white stroke.
 * @example
 * map.addControl(new mapboxgl.GeolocateControl({
 *     positionOptions: {
 *         enableHighAccuracy: true
 *     },
 *     watchPosition: true,
 *     markerPaintProperties: {
 *         'circle-color': '#000'
 *     }
 * }));
 */
class GeolocateControl extends Evented {

    constructor(options) {
        super();
        this.options = options || {};

        // apply default for options.showMarker
        this.options.showMarker = (this.options && 'showMarker' in this.options) ? this.options.showMarker : true;

        util.bindAll([
            '_onSuccess',
            '_onError',
            '_finish',
            '_setupUI',
            '_updateCamera',
            '_updateMarker',
            '_setupMarker',
            '_onClickGeolocate'
        ], this);
    }

    onAdd(map) {
        this._map = map;
        this._container = DOM.create('div', `${className} ${className}-group`);
        checkGeolocationSupport(this._setupUI);
        return this._container;
    }

    onRemove() {
        // clear the geolocation watch if exists
        if (this._geolocationWatchID !== undefined) {
            window.navigator.geolocation.clearWatch(this._geolocationWatchID);
            this._geolocationWatchID = undefined;
        }

        // clear the marker from the map
        if (this.options.showMarker) {
            if (this._map.getLayer(markerLayerName)) this._map.removeLayer(markerLayerName);
            if (this._map.getSource(markerSourceName)) this._map.removeSource(markerSourceName);
        }

        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }

    _onSuccess(position) {
        if (this.options.watchPosition) {
            // keep a record of the position so that if the state is BACKGROUND and the user
            // clicks the button, we can move to ACTIVE_LOCK immediately without waiting for
            // watchPosition to trigger _onSuccess
            this._lastKnownPosition = position;

            console.log(`GPS Success old watch state ${this._watchState}`);
            switch (this._watchState) {
            case 'WAITING_ACTIVE':
            case 'ACTIVE_LOCK':
            case 'ACTIVE_ERROR':
                this._watchState = 'ACTIVE_LOCK';
                this._geolocateButton.classList.remove('waiting');
                this._geolocateButton.classList.remove('active-error');
                this._geolocateButton.classList.add('active');
                break;
            case 'BACKGROUND':
            case 'BACKGROUND_ERROR':
                this._watchState = 'BACKGROUND';
                this._geolocateButton.classList.remove('waiting');
                this._geolocateButton.classList.remove('background-error');
                this._geolocateButton.classList.add('background');
                break;
            default:
                assert(false, `Unexpected watchState ${this._watchState}`);
            }
            this._geolocateButton.classList.remove('waiting');
            console.log(`...new watch state ${this._watchState}`);
            console.log(`...classList ${this._geolocateButton.classList}`);
        }

        // if in normal mode (not watch mode), or if in watch mode and the state is active watch
        // then update the camera
        if (!this.options.watchPosition || this._watchState === 'ACTIVE_LOCK') {
            console.log('update camera location');
            this._updateCamera(position);
        }

        // if showMarker and the watch state isn't off then update the marker location
        if (this.options.showMarker && this._watchState !== 'OFF') {
            console.log('update marker location');
            this._updateMarker(position);
        }

        if (this.options.showMarker) {
            // restore any paint properties which were changed to make the marker stale
            for (const paintProperty in this._markerStalePaintProperties) {
                this._map.setPaintProperty(markerLayerName, paintProperty, this._markerPaintProperties[paintProperty]);
            }
        }

        if (this._watchState === 'ACTIVE_LOCK') {
            this.fire('active_lock');
        }

        this.fire('geolocate', position);
        this._finish();
    }

    _updateCamera(position) {
        this._map.jumpTo({
            center: [position.coords.longitude, position.coords.latitude],
            zoom: 17,
            bearing: 0,
            pitch: 0
        }, {
            geolocateSource: true // tag this camera change so it won't cause the control to change to background state
        });
    }

    _updateMarker(position) {
        if (position) {
            this._map.getSource(markerSourceName).setData({
                "type": "FeatureCollection",
                "features": [{
                    "type": "Feature",
                    "properties": {
                        "accuracy": position.coords.accuracy
                    },
                    "geometry": {
                        "type": "Point",
                        "coordinates": [position.coords.longitude, position.coords.latitude]
                    }
                }]
            });
        } else {
            this._map.getSource(markerSourceName).setData({
                "type": "FeatureCollection",
                "features": []
            });
        }
    }

    _onError(error) {
        console.log(`GPS Error old watch state ${this._watchState}`);
        if (this.options.watchPosition) {
            if (error.code === 1) {
                // PERMISSION_DENIED
                this._watchState = 'OFF';
                this._geolocateButton.classList.remove('waiting');
                this._geolocateButton.classList.remove('active');
                this._geolocateButton.classList.remove('active-error');
                this._geolocateButton.classList.remove('background');
                this._geolocateButton.classList.remove('background-error');
            } else {
                switch (this._watchState) {
                case 'WAITING_ACTIVE':
                    this._watchState = 'ACTIVE_ERROR';
                    this._geolocateButton.classList.remove('active');
                    this._geolocateButton.classList.add('active-error');
                    break;
                case 'ACTIVE_LOCK':
                    this._watchState = 'ACTIVE_ERROR';
                    this._geolocateButton.classList.remove('active');
                    this._geolocateButton.classList.add('active-error');
                    this._geolocateButton.classList.add('waiting');
                    // turn marker grey
                    break;
                case 'BACKGROUND':
                    this._watchState = 'BACKGROUND_ERROR';
                    this._geolocateButton.classList.remove('background');
                    this._geolocateButton.classList.add('background-error');
                    this._geolocateButton.classList.add('waiting');
                    // turn marker grey
                    break;
                case 'ACTIVE_ERROR':
                    break;
                default:
                    assert(false, `Unexpected watchState ${this._watchState}`);
                }
            }
            console.log(`...new watch state ${this._watchState}`);
            console.log(`...classList ${this._geolocateButton.classList}`);
        }
        console.log(error);

        if (this.options.showMarker) {
            // apply paint properties to make the marker stale
            for (const paintProperty in this._markerStalePaintProperties) {
                this._map.setPaintProperty(markerLayerName, paintProperty, this._markerStalePaintProperties[paintProperty]);
            }
        }

        this.fire('error', error);

        this._finish();
    }

    _finish() {
        if (this._timeoutId) { clearTimeout(this._timeoutId); }
        this._timeoutId = undefined;

        console.log('finish');
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

        if (this.options.watchPosition) {
            this._geolocateButton.setAttribute('aria-pressed', false);
            this._watchState = 'OFF';
        }

        // when showMarker is enabled, keep the Geolocate button disabled until the device location marker is setup on the map
        if (this.options.showMarker) {
            if (this.options.watchPosition) this._watchState = 'INITILIZE';
            this._geolocateButton.disabled = true;
            this._setupMarker();
        }

        this._geolocateButton.addEventListener('click',
            this._onClickGeolocate.bind(this));

        // when the camera is changed (and it's not as a result of the Geolocation Control) change
        // the watch mode to background watch, so that the marker is updated but not the camera.
        if (this.options.watchPosition) {
            this._map.on('movestart', (event) => {
                if (!event.geolocateSource) {
                    console.log(`movestart event old watch state ${this._watchState}`);
                    if (this._watchState === 'ACTIVE_LOCK') {
                        this._watchState = 'BACKGROUND';
                        this._geolocateButton.classList.add('background');
                        this._geolocateButton.classList.remove('active');

                        this.fire('background');
                    }
                    console.log(`...new watch state ${this._watchState}`);
                    console.log(`...classList ${this._geolocateButton.classList}`);
                }
            });
        }

        if (!this.options.showMarker) this.fire('ready');
    }

    _setupMarker() {
        const defaultMarkerPaintProperties = {
            'circle-radius': 9,
            'circle-color': '#33b5e5',
            'circle-stroke-color': '#fff',
            'circle-stroke-width': 3
        };
        const defaultMarkerShadowPaintProperties = {
            'circle-radius': 14,
            'circle-color': '#000',
            'circle-opacity': 0.5,
            'circle-blur': 0.4,
            'circle-translate': [2, 2],
            'circle-translate-anchor': 'viewport'
        };
        const defaultMarkerStalePaintProperties = {
            'circle-color': '#a6d5e5',
            'circle-opacity': 0.5,
            'circle-stroke-opacity': 0.8
        };

        this._markerPaintProperties = this.options.markerPaintProperties || defaultMarkerPaintProperties;
        this._markerShadowPaintProperties = this.options.markerShadowPaintProperties || defaultMarkerShadowPaintProperties;
        this._markerStalePaintProperties = util.extend({}, this._markerPaintProperties, this.options.markerStalePaintProperties || defaultMarkerStalePaintProperties);

        // sources can't be added until the Map style is loaded
        this._map.on('load', () => {
            this._map.addSource(markerSourceName, {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: []
                }
            });

            this._map.addLayer({
                id: markerShadowLayerName,
                source: markerSourceName,
                type: 'circle',
                paint: this._markerShadowPaintProperties
            });
            this._map.addLayer({
                id: markerLayerName,
                source: markerSourceName,
                type: 'circle',
                paint: this._markerPaintProperties
            });

            if (this.options.watchPosition) this._watchState = 'OFF';

            this._geolocateButton.disabled = false;

            this.fire('ready');
        });
    }

    _onClickGeolocate() {
        const positionOptions = util.extend(defaultGeoPositionOptions, this.options && this.options.positionOptions || {});

        if (this.options.watchPosition) {
            console.log(`Click Geolocate old watch state ${this._watchState}`);

            // update watchState and do any outgoing state cleanup
            switch (this._watchState) {
            case 'OFF':
                // turn on the Geolocate Control
                this._watchState = 'WAITING_ACTIVE';
                break;
            case 'WAITING_ACTIVE':
            case 'ACTIVE_LOCK':
            case 'ACTIVE_ERROR':
            case 'BACKGROUND_ERROR':
                // turn off the Geolocate Control
                this._watchState = 'OFF';
                this._geolocateButton.classList.remove('waiting');
                this._geolocateButton.classList.remove('active');
                this._geolocateButton.classList.remove('active-error');
                this._geolocateButton.classList.remove('background');
                this._geolocateButton.classList.remove('background-error');
                break;
            case 'BACKGROUND':
                this._watchState = 'ACTIVE_LOCK';
                this._geolocateButton.classList.remove('background');
                // set camera to last known location
                if (this._lastKnownPosition) this._updateCamera(this._lastKnownPosition);
                break;
            default:
                assert(false, `Unexpected watchState ${this._watchState}`);
            }

            // incoming state setup
            switch (this._watchState) {
            case 'WAITING_ACTIVE':
                this._geolocateButton.classList.add('waiting');
                this._geolocateButton.classList.add('active');
                break;
            case 'ACTIVE_LOCK':
                this._geolocateButton.classList.add('active');
                break;
            case 'ACTIVE_ERROR':
                this._geolocateButton.classList.add('waiting');
                this._geolocateButton.classList.add('active-error');
                break;
            case 'BACKGROUND':
                this._geolocateButton.classList.add('background');
                break;
            case 'BACKGROUND_ERROR':
                this._geolocateButton.classList.add('waiting');
                this._geolocateButton.classList.add('background-error');
                break;
            case 'OFF':
                break;
            default:
                assert(false, `Unexpected watchState ${this._watchState}`);
            }

            console.log(`...new watch state ${this._watchState}`);
            console.log(`...classList ${this._geolocateButton.classList}`);

            // manage geolocation.watchPosition / geolocation.clearWatch
            if (this._watchState === 'OFF' && this._geolocationWatchID !== undefined) {
                // clear watchPosition as we've changed to an OFF state

                console.log('clear watch');
                window.navigator.geolocation.clearWatch(this._geolocationWatchID);

                this._geolocationWatchID = undefined;
                this._geolocateButton.classList.remove('waiting');
                this._geolocateButton.setAttribute('aria-pressed', false);

                if (this.options.showMarker) {
                    this._updateMarker(null);
                }
            } else if (this._geolocationWatchID === undefined) {
                // enable watchPosition since watchState is not OFF and there is no watchPosition already running

                this._geolocateButton.classList.add('waiting');
                this._geolocateButton.setAttribute('aria-pressed', true);

                this._geolocationWatchID = window.navigator.geolocation.watchPosition(
                    this._onSuccess, this._onError, positionOptions);
            }

            if (this._watchState === 'ACTIVE_LOCK') {
                this.fire('active_lock');
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
 * Fired on each Geolocation API position update which returned as success.
 *
 * @event geolocate
 * @memberof GeolocateControl
 * @instance
 * @property {Position} data The returned [Position](https://developer.mozilla.org/en-US/docs/Web/API/Position) object from the callback in [Geolocation.getCurrentPosition()](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition) or [Geolocation.watchPosition()](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition).
 *
 */

/**
 * Fired on each Geolocation API position update which returned as an error.
 *
 * @event error
 * @memberof GeolocateControl
 * @instance
 * @property {PositionError} data The returned [PositionError](https://developer.mozilla.org/en-US/docs/Web/API/PositionError) object from the callback in [Geolocation.getCurrentPosition()](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition) or [Geolocation.watchPosition()](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition).
 *
 */

/**
 * Fired when the Geolocate Control is ready and able to be clicked.
 *
 * @event ready
 * @memberof GeolocateControl
 * @instance
 *
 */

/**
 * Fired when the Geolocate Control changes to the active_lock state, which happens either when we first obtain a successful Geolocation API position for the device (a geolocate event will follow), or the user clicks the geolocate button when in the background state which uses the last known position to recenter the map and enter active_lock state (no geolocate event will follow unless the device's location changes).
 *
 * @event active_lock
 * @memberof GeolocateControl
 * @instance
 *
 */

/**
 * Fired when the Geolocate Control changes to the background state, which happens when a user changes the camera during an active position lock. This only applies when watchPosition is true. In the background state, the marker on the map will update with location updates but the camera will not.
 *
 * @event background
 * @memberof GeolocateControl
 * @instance
 *
 */
