// @flow

import { Event, Evented } from '../../util/evented';
import DOM from '../../util/dom';
import window from '../../util/window';
import { extend, bindAll, warnOnce } from '../../util/util';
import assert from 'assert';
import LngLat from '../../geo/lng_lat';
import Marker from '../marker';

import type Map from '../map';
import type { AnimationOptions, CameraOptions } from '../camera';

type Options = {
    positionOptions?: PositionOptions,
    fitBoundsOptions?: AnimationOptions & CameraOptions,
    trackUserLocation?: boolean,
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
    showUserLocation: true
};
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
 *  `GeolocateControl` 工具提供一个按钮，该按钮利用浏览器的 geolocation API 对用户进行定位.
 * 并不是所有的浏览器都支持地理定位,一些用户也有可能禁用了该功能。 
 * Geolocation support for modern browsers including Chrome requires sites to be served over HTTPS. 
 * 若浏览器地理定位功能不可用, GeolocateControl 工具将隐藏.
 * 地图缩放级别依赖于设备提供的地理定位精度.
 * 地理定位有两种模式. 若 `trackUserLocation` 为 `false` (默认),则定位工具类似于按钮,当按下按钮时,地图相机瞄准用户位置. 如果用户移动,地图不会刷新. 这种模式最适合桌面应用. 如果 `trackUserLocation` 为 `true` ,该工具表现为一个切换按钮, 当用户位置激活时，积极监控用户位置变化. 在这种模式下,该地理定位工具有三种状态:
 * * 主动 - 地图相机随着用户位置变化自动更新, 保持用户位置居于地图中心点.
 * * 被动 - 用户定位点自动更新,但地图相机不更新.
 * * 禁用
 *
 * @implements {IControl}
 * @param {Object} [options]
 * @param {Object} [options.positionOptions={enableHighAccuracy: false, timeout: 6000}] A Geolocation API [PositionOptions](https://developer.mozilla.org/en-US/docs/Web/API/PositionOptions) object.
 * @param {Object} [options.fitBoundsOptions={maxZoom: 15}] A [`fitBounds`](#Map#fitBounds) options object to use when the map is panned and zoomed to the user's location. The default is to use a `maxZoom` of 15 to limit how far the map will zoom in for very accurate locations.
 * @param {Object} [options.trackUserLocation=false] If `true` the Geolocate Control becomes a toggle button and when active the map will receive updates to the user's location as it changes.
 * @param {Object} [options.showUserLocation=true] By default a dot will be shown on the map at the user's location. Set to `false` to disable.
 *
 * @example
 * map.addControl(new mapboxgl.GeolocateControl({
 *     positionOptions: {
 *         enableHighAccuracy: true
 *     },
 *     trackUserLocation: true
 * }));
 * @see [用户定位](https://www.mapbox.com/mapbox-gl-js/example/locate-user/)
 */
class GeolocateControl extends Evented {
    _map: Map;
    options: Options;
    _container: HTMLElement;
    _dotElement: HTMLElement;
    _geolocateButton: HTMLElement;
    _geolocationWatchID: number;
    _timeoutId: ?TimeoutID;
    _watchState: string;
    _lastKnownPosition: any;
    _userLocationDotMarker: Marker;
    _setup: boolean; // set to true once the control has been setup

    constructor(options: Options) {
        super();
        this.options = extend({}, defaultOptions, options);

        bindAll([
            '_onSuccess',
            '_onError',
            '_finish',
            '_setupUI',
            '_updateCamera',
            '_updateMarker'
        ], this);
    }

    onAdd(map: Map) {
        this._map = map;
        this._container = DOM.create('div', `${className} ${className}-group`);
        checkGeolocationSupport(this._setupUI);
        return this._container;
    }

    onRemove() {
        // clear the geolocation watch if exists
        if (this._geolocationWatchID !== undefined) {
            window.navigator.geolocation.clearWatch(this._geolocationWatchID);
            this._geolocationWatchID = (undefined: any);
        }

        // clear the marker from the map
        if (this.options.showUserLocation && this._userLocationDotMarker) {
            this._userLocationDotMarker.remove();
        }

        DOM.remove(this._container);
        this._map = (undefined: any);
    }

    _onSuccess(position: Position) {
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

        this._map.fitBounds(center.toBounds(radius), this.options.fitBoundsOptions, {
            geolocateSource: true // tag this camera change so it won't cause the control to change to background state
        });
    }

    _updateMarker(position: ?Position) {
        if (position) {
            this._userLocationDotMarker.setLngLat([position.coords.longitude, position.coords.latitude]).addTo(this._map);
        } else {
            this._userLocationDotMarker.remove();
        }
    }

    _onError(error: PositionError) {
        if (this.options.trackUserLocation) {
            if (error.code === 1) {
                // PERMISSION_DENIED
                this._watchState = 'OFF';
                this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-waiting');
                this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-active');
                this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-active-error');
                this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-background');
                this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-background-error');

                if (this._geolocationWatchID !== undefined) {
                    this._clearWatch();
                }
            } else {
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
        if (supported === false) {
            warnOnce('Geolocation support is not available, the GeolocateControl will not be visible.');
            return;
        }
        this._container.addEventListener('contextmenu', (e: MouseEvent) => e.preventDefault());
        this._geolocateButton = DOM.create('button',
            `${className}-icon ${className}-geolocate`,
            this._container);
        this._geolocateButton.type = 'button';
        this._geolocateButton.setAttribute('aria-label', 'Geolocate');

        if (this.options.trackUserLocation) {
            this._geolocateButton.setAttribute('aria-pressed', 'false');
            this._watchState = 'OFF';
        }

        // when showUserLocation is enabled, keep the Geolocate button disabled until the device location marker is setup on the map
        if (this.options.showUserLocation) {
            this._dotElement = DOM.create('div', 'mapboxgl-user-location-dot');

            this._userLocationDotMarker = new Marker(this._dotElement);

            if (this.options.trackUserLocation) this._watchState = 'OFF';
        }

        this._geolocateButton.addEventListener('click',
            this.trigger.bind(this));

        this._setup = true;

        // when the camera is changed (and it's not as a result of the Geolocation Control) change
        // the watch mode to background watch, so that the marker is updated but not the camera.
        if (this.options.trackUserLocation) {
            this._map.on('movestart', (event) => {
                if (!event.geolocateSource && this._watchState === 'ACTIVE_LOCK') {
                    this._watchState = 'BACKGROUND';
                    this._geolocateButton.classList.add('mapboxgl-ctrl-geolocate-background');
                    this._geolocateButton.classList.remove('mapboxgl-ctrl-geolocate-active');

                    this.fire(new Event('trackuserlocationend'));
                }
            });
        }
    }

    /**
     * 触发地理定位
     *
     * @returns {boolean} 如果工具调用发生在被添加进地图之前则返回 `false` , 否则返回 `true`.
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

                this._geolocationWatchID = window.navigator.geolocation.watchPosition(
                    this._onSuccess, this._onError, this.options.positionOptions);
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

/* 地理定位工具的观察状态
 * 这是工具的私有状态.
 *
 * OFF
 *    off/inactive
 * WAITING_ACTIVE
 *    地理定位工具被点击,却一直在等待 Geolocation API 对用户位置作出响应
 * ACTIVE_LOCK
 *    显示用户点位并追踪地图相机固定到定位点. 如果位置改变地图跟着移动.
 * ACTIVE_ERROR
 *    Geolocation API 在尝试显示和追踪用户位置时报错.
 * BACKGROUND
 *    显示了用户点位,但相机并没有跟随用户位置变化.
 * BACKGROUND_ERROR
 *    Geolocation API在尝试显示用户点位时(并不跟踪)出错.
 */


/**
 * Geolocation API位置每次更新成功时触发.
 *
 * @event geolocate
 * @memberof GeolocateControl
 * @instance
 * @property {Position} data The returned [Position](https://developer.mozilla.org/en-US/docs/Web/API/Position) object from the callback in [Geolocation.getCurrentPosition()](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition) or [Geolocation.watchPosition()](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition).
 *
 */

/**
 * Geolocation API位置每次更新出错时触发.
 *
 * @event error
 * @memberof GeolocateControl
 * @instance
 * @property {PositionError} data The returned [PositionError](https://developer.mozilla.org/en-US/docs/Web/API/PositionError) object from the callback in [Geolocation.getCurrentPosition()](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition) or [Geolocation.watchPosition()](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition).
 *
 */

/**
 * 当地理定位工具状态变为 ACTIVE_LOCK 时触发.要么是第一次成功获取到用户的 Geolocation API 定位时触发 (地理定位事件随后触发), 要么是用户在 background 状态(该状态是使用最近一次可知的位置居中地图并进入active lock状态)点击地理定位按钮时触发. (除非用户位置改变,否则不触发地理定事件).
 *
 * @event trackuserlocationstart
 * @memberof GeolocateControl
 * @instance
 *
 */

/**
 * 当地理定位工具状态变为 BACKGROUND 时触发, which happens when a user changes the camera during an active position lock. This only applies when trackUserLocation is true. In the background state, the dot on the map will update with location updates but the camera will not.
 *
 * @event trackuserlocationend
 * @memberof GeolocateControl
 * @instance
 *
 */
