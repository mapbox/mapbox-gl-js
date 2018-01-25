// @flow

const DOM = require('../../util/dom');
const util = require('../../util/util');
const browser = require('../../util/browser');
const window = require('../../util/window');
const interpolate = require('../../style-spec/util/interpolate').number;
const LngLat = require('../../geo/lng_lat');

import type Map from '../map';
import type Point from '@mapbox/point-geometry';
import type Transform from '../../geo/transform';

// deltaY value for mouse scroll wheel identification
const wheelZoomDelta = 4.000244140625;
// These magic numbers control the rate of zoom. Trackpad events fire at a greater
// frequency than mouse scroll wheel, so reduce the zoom rate per wheel tick
const defaultZoomRate = 1 / 100;
const wheelZoomRate = 1 / 450;

// upper bound on how much we scale the map in any single render frame; this
// is used to limit zoom rate in the case of very fast scrolling
const maxScalePerFrame = 2;

const ua = window.navigator.userAgent.toLowerCase(),
    firefox = ua.indexOf('firefox') !== -1,
    safari = ua.indexOf('safari') !== -1 && ua.indexOf('chrom') === -1;

/**
 * The `ScrollZoomHandler` allows the user to zoom the map by scrolling.
 *
 * @param {Map} map The Mapbox GL JS map to add the handler to.
 */
class ScrollZoomHandler {
    _map: Map;
    _el: HTMLElement;
    _enabled: boolean;
    _active: boolean;
    _aroundCenter: boolean;
    _around: Point;
    _aroundPoint: Point;
    _type: 'wheel' | 'trackpad' | null;
    _lastValue: number;
    _timeout: ?number; // used for delayed-handling of a single wheel movement
    _finishTimeout: ?number; // used to delay final '{move,zoom}end' events

    _lastWheelEvent: any;
    _lastWheelEventTime: number;

    _startZoom: number;
    _targetZoom: number;
    _delta: number;
    _easing: (number) => number;
    _prevEase: {start: number, duration: number, easing: (number) => number};

    constructor(map: Map) {
        this._map = map;
        this._el = map.getCanvasContainer();

        this._delta = 0;

        util.bindAll([
            '_onWheel',
            '_onTimeout',
            '_onScrollFrame',
            '_onScrollFinished'
        ], this);
    }

    /**
     * Returns a Boolean indicating whether the "scroll to zoom" interaction is enabled.
     *
     * @returns {boolean} `true` if the "scroll to zoom" interaction is enabled.
     */
    isEnabled() {
        return !!this._enabled;
    }

    isActive() {
        return !!this._active;
    }

    /**
     * Enables the "scroll to zoom" interaction.
     *
     * @param {Object} [options]
     * @param {string} [options.around] If "center" is passed, map will zoom around center of map
     *
     * @example
     *   map.scrollZoom.enable();
     * @example
     *  map.scrollZoom.enable({ around: 'center' })
     */
    enable(options: any) {
        if (this.isEnabled()) return;
        this._el.addEventListener('wheel', this._onWheel, false);
        this._el.addEventListener('mousewheel', this._onWheel, false);
        this._enabled = true;
        this._aroundCenter = options && options.around === 'center';
    }

    /**
     * Disables the "scroll to zoom" interaction.
     *
     * @example
     *   map.scrollZoom.disable();
     */
    disable() {
        if (!this.isEnabled()) return;
        this._el.removeEventListener('wheel', this._onWheel);
        this._el.removeEventListener('mousewheel', this._onWheel);
        this._enabled = false;
    }

    _onWheel(e: any) {
        let value = 0;

        if (e.type === 'wheel') {
            value = e.deltaY;
            // Firefox doubles the values on retina screens...
            // Remove `any` casts when https://github.com/facebook/flow/issues/4879 is fixed.
            if (firefox && e.deltaMode === (window.WheelEvent: any).DOM_DELTA_PIXEL) value /= browser.devicePixelRatio;
            if (e.deltaMode === (window.WheelEvent: any).DOM_DELTA_LINE) value *= 40;

        } else if (e.type === 'mousewheel') {
            value = -e.wheelDeltaY;
            if (safari) value = value / 3;
        }

        const now = browser.now(),
            timeDelta = now - (this._lastWheelEventTime || 0);

        this._lastWheelEventTime = now;

        if (value !== 0 && (value % wheelZoomDelta) === 0) {
            // This one is definitely a mouse wheel event.
            this._type = 'wheel';

        } else if (value !== 0 && Math.abs(value) < 4) {
            // This one is definitely a trackpad event because it is so small.
            this._type = 'trackpad';

        } else if (timeDelta > 400) {
            // This is likely a new scroll action.
            this._type = null;
            this._lastValue = value;

            // Start a timeout in case this was a singular event, and dely it by up to 40ms.
            this._timeout = setTimeout(this._onTimeout, 40, e);

        } else if (!this._type) {
            // This is a repeating event, but we don't know the type of event just yet.
            // If the delta per time is small, we assume it's a fast trackpad; otherwise we switch into wheel mode.
            this._type = (Math.abs(timeDelta * value) < 200) ? 'trackpad' : 'wheel';

            // Make sure our delayed event isn't fired again, because we accumulate
            // the previous event (which was less than 40ms ago) into this event.
            if (this._timeout) {
                clearTimeout(this._timeout);
                this._timeout = null;
                value += this._lastValue;
            }
        }

        // Slow down zoom if shift key is held for more precise zooming
        if (e.shiftKey && value) value = value / 4;

        // Only fire the callback if we actually know what type of scrolling device the user uses.
        if (this._type) {
            this._lastWheelEvent = e;
            this._delta -= value;
            if (!this.isActive()) {
                this._start(e);
            }
        }

        e.preventDefault();
    }

    _onTimeout(initialEvent: any) {
        this._type = 'wheel';
        this._delta -= this._lastValue;
        if (!this.isActive()) {
            this._start(initialEvent);
        }
    }

    _start(e: any) {
        if (!this._delta) return;

        this._active = true;
        this._map.moving = true;
        this._map.zooming = true;
        this._map.fire('movestart', {originalEvent: e});
        this._map.fire('zoomstart', {originalEvent: e});
        clearTimeout(this._finishTimeout);

        const pos = DOM.mousePos(this._el, e);

        this._around = LngLat.convert(this._aroundCenter ? this._map.getCenter() : this._map.unproject(pos));
        this._aroundPoint = this._map.transform.locationPoint(this._around);
        this._map._startAnimation(this._onScrollFrame, this._onScrollFinished);
    }

    _onScrollFrame(tr: Transform) {
        if (!this.isActive()) return;

        // if we've had scroll events since the last render frame, consume the
        // accumulated delta, and update the target zoom level accordingly
        if (this._delta !== 0) {
            // For trackpad events and single mouse wheel ticks, use the default zoom rate
            const zoomRate = (this._type === 'wheel' && Math.abs(this._delta) > wheelZoomDelta) ? wheelZoomRate : defaultZoomRate;
            // Scale by sigmoid of scroll wheel delta.
            let scale = maxScalePerFrame / (1 + Math.exp(-Math.abs(this._delta * zoomRate)));

            if (this._delta < 0 && scale !== 0) {
                scale = 1 / scale;
            }

            const fromScale = typeof this._targetZoom === 'number' ? tr.zoomScale(this._targetZoom) : tr.scale;
            this._targetZoom = Math.min(tr.maxZoom, Math.max(tr.minZoom, tr.scaleZoom(fromScale * scale)));

            // if this is a mouse wheel, refresh the starting zoom and easing
            // function we're using to smooth out the zooming between wheel
            // events
            if (this._type === 'wheel') {
                this._startZoom = tr.zoom;
                this._easing = this._smoothOutEasing(200);
            }

            this._delta = 0;
        }

        if (this._type === 'wheel') {
            const t = Math.min((browser.now() - this._lastWheelEventTime) / 200, 1);
            const k = this._easing(t);
            tr.zoom = interpolate(this._startZoom, this._targetZoom, k);
            if (t === 1) this._map.stop();
        } else {
            tr.zoom = this._targetZoom;
            this._map.stop();
        }

        tr.setLocationAtPoint(this._around, this._aroundPoint);

        this._map.fire('move', {originalEvent: this._lastWheelEvent});
        this._map.fire('zoom', {originalEvent: this._lastWheelEvent});
    }

    _onScrollFinished() {
        if (!this.isActive()) return;
        this._active = false;
        this._finishTimeout = setTimeout(() => {
            this._map.moving = false;
            this._map.zooming = false;
            this._map.fire('zoomend');
            this._map.fire('moveend');
            delete this._targetZoom;
        }, 200);
    }

    _smoothOutEasing(duration: number) {
        let easing = util.ease;

        if (this._prevEase) {
            const ease = this._prevEase,
                t = (browser.now() - ease.start) / ease.duration,
                speed = ease.easing(t + 0.01) - ease.easing(t),

                // Quick hack to make new bezier that is continuous with last
                x = 0.27 / Math.sqrt(speed * speed + 0.0001) * 0.01,
                y = Math.sqrt(0.27 * 0.27 - x * x);

            easing = util.bezier(x, y, 0.25, 1);
        }

        this._prevEase = {
            start: browser.now(),
            duration: duration,
            easing: easing
        };

        return easing;
    }
}

module.exports = ScrollZoomHandler;
