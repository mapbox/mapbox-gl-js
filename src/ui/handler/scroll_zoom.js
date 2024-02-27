// @flow

import assert from 'assert';
import * as DOM from '../../util/dom.js';

import {ease as _ease, bindAll, bezier, isFullscreen} from '../../util/util.js';
import browser from '../../util/browser.js';
import {number as interpolate} from '../../style-spec/util/interpolate.js';
import Point from '@mapbox/point-geometry';

import type Map from '../map.js';
import type HandlerManager from '../handler_manager.js';
import type {Handler, HandlerResult} from '../handler.js';
import MercatorCoordinate from '../../geo/mercator_coordinate.js';

// deltaY value for mouse scroll wheel identification
const wheelZoomDelta = 4.000244140625;

// These magic numbers control the rate of zoom. Trackpad events fire at a greater
// frequency than mouse scroll wheel, so reduce the zoom rate per wheel tick
const defaultZoomRate = 1 / 100;
const wheelZoomRate = 1 / 450;

// upper bound on how much we scale the map in any single render frame; this
// is used to limit zoom rate in the case of very fast scrolling
const maxScalePerFrame = 2;

/**
 * The `ScrollZoomHandler` allows the user to zoom the map by scrolling.
 *
 * @see [Example: Toggle interactions](https://docs.mapbox.com/mapbox-gl-js/example/toggle-interaction-handlers/)
 * @see [Example: Disable scroll zoom](https://docs.mapbox.com/mapbox-gl-js/example/disable-scroll-zoom/)
 */
class ScrollZoomHandler implements Handler {
    _map: Map;
    _el: HTMLElement;
    _enabled: boolean;
    _active: boolean;
    _zooming: boolean;
    _aroundCenter: boolean;
    _aroundPoint: Point;
    _aroundCoord: MercatorCoordinate;
    _type: 'wheel' | 'trackpad' | null;
    _lastValue: number;
    _timeout: ?TimeoutID; // used for delayed-handling of a single wheel movement
    _finishTimeout: ?TimeoutID; // used to delay final '{move,zoom}end' events

    _lastWheelEvent: any;
    _lastWheelEventTime: number;

    _startZoom: ?number;
    _targetZoom: ?number;
    _delta: number;
    _lastDelta: number;
    _easing: ?((number) => number);
    _prevEase: ?{start: number, duration: number, easing: (_: number) => number};

    _frameId: ?boolean;
    _handler: HandlerManager;

    _defaultZoomRate: number;
    _wheelZoomRate: number;

    _alertContainer: HTMLElement; // used to display the scroll zoom blocker alert
    _alertTimer: TimeoutID;

    /**
     * @private
     */
    constructor(map: Map, handler: HandlerManager) {
        this._map = map;
        this._el = map.getCanvasContainer();
        this._handler = handler;

        this._delta = 0;
        this._lastDelta = 0;

        this._defaultZoomRate = defaultZoomRate;
        this._wheelZoomRate = wheelZoomRate;

        bindAll(['_onTimeout', '_addScrollZoomBlocker', '_showBlockerAlert'], this);

    }

    /**
     * Sets the zoom rate of a trackpad.
     *
     * @param {number} [zoomRate=1/100] The rate used to scale trackpad movement to a zoom value.
     * @example
     * // Speed up trackpad zoom
     * map.scrollZoom.setZoomRate(1 / 25);
     */
    setZoomRate(zoomRate: number) {
        this._defaultZoomRate = zoomRate;
    }

    /**
    * Sets the zoom rate of a mouse wheel.
     *
    * @param {number} [wheelZoomRate=1/450] The rate used to scale mouse wheel movement to a zoom value.
    * @example
    * // Slow down zoom of mouse wheel
    * map.scrollZoom.setWheelZoomRate(1 / 600);
    */
    setWheelZoomRate(wheelZoomRate: number) {
        this._wheelZoomRate = wheelZoomRate;
    }

    /**
     * Returns a Boolean indicating whether the "scroll to zoom" interaction is enabled.
     *
     * @returns {boolean} `true` if the "scroll to zoom" interaction is enabled.
     * @example
     * const isScrollZoomEnabled = map.scrollZoom.isEnabled();
     */
    isEnabled(): boolean {
        return !!this._enabled;
    }

    /*
    * Active state is turned on and off with every scroll wheel event and is set back to false before the map
    * render is called, so _active is not a good candidate for determining if a scroll zoom animation is in
    * progress.
    */
    isActive(): boolean {
        return this._active || this._finishTimeout !== undefined;
    }

    isZooming(): boolean {
        return !!this._zooming;
    }

    /**
     * Enables the "scroll to zoom" interaction.
     *
     * @param {Object} [options] Options object.
     * @param {string} [options.around] If "center" is passed, map will zoom around center of map.
     *
     * @example
     * map.scrollZoom.enable();
     * @example
     * map.scrollZoom.enable({around: 'center'});
     */
    enable(options: ?{around?: 'center'}) {
        if (this.isEnabled()) return;
        this._enabled = true;
        this._aroundCenter = !!options && options.around === 'center';
        if (this._map._cooperativeGestures) this._addScrollZoomBlocker();
    }

    /**
     * Disables the "scroll to zoom" interaction.
     *
     * @example
     * map.scrollZoom.disable();
     */
    disable() {
        if (!this.isEnabled()) return;
        this._enabled = false;
        if (this._map._cooperativeGestures) {
            clearTimeout(this._alertTimer);
            this._alertContainer.remove();
        }
    }

    // $FlowFixMe[method-unbinding]
    wheel(e: WheelEvent) {
        if (!this.isEnabled()) return;

        if (this._map._cooperativeGestures) {
            if (!e.ctrlKey && !e.metaKey && !this.isZooming() && !isFullscreen()) {
                this._showBlockerAlert();
                return;
            } else if (this._alertContainer.style.visibility !== 'hidden') {
                // immediately hide alert if it is visible when ctrl or ⌘ is pressed while scroll zooming.
                this._alertContainer.style.visibility = 'hidden';
                clearTimeout(this._alertTimer);
            }
        }

        // Remove `any` cast when https://github.com/facebook/flow/issues/4879 is fixed.
        let value = e.deltaMode === (WheelEvent: any).DOM_DELTA_LINE ? e.deltaY * 40 : e.deltaY;
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

            // Start a timeout in case this was a singular event, and delay it by up to 40ms.
            // $FlowFixMe[method-unbinding]
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
            if (!this._active) {
                this._start(e);
            }
        }

        e.preventDefault();
    }

    _onTimeout(initialEvent: WheelEvent) {
        this._type = 'wheel';
        this._delta -= this._lastValue;
        if (!this._active) {
            this._start(initialEvent);
        }
    }

    _start(e: WheelEvent) {
        if (!this._delta) return;

        if (this._frameId) {
            this._frameId = null;
        }

        this._active = true;
        if (!this.isZooming()) {
            this._zooming = true;
        }

        if (this._finishTimeout) {
            clearTimeout(this._finishTimeout);
            delete this._finishTimeout;
        }

        const pos = DOM.mousePos(this._el, e);
        this._aroundPoint = this._aroundCenter ? this._map.transform.centerPoint : pos;
        this._aroundCoord = this._map.transform.pointCoordinate3D(this._aroundPoint);
        this._targetZoom = undefined;

        if (!this._frameId) {
            this._frameId = true;
            this._handler._triggerRenderFrame();
        }
    }

    // $FlowFixMe[method-unbinding]
    renderFrame(): ?HandlerResult {
        if (!this._frameId) return;
        this._frameId = null;

        if (!this.isActive()) return;

        const tr = this._map.transform;

        // If projection wraps and center crosses the antimeridian, reset previous mouse scroll easing settings to resolve https://github.com/mapbox/mapbox-gl-js/issues/11910
        if (this._type === 'wheel' && tr.projection.wrap && (tr._center.lng >= 180 || tr._center.lng <= -180)) {
            this._prevEase = null;
            this._easing = null;
            this._lastWheelEvent = null;
            this._lastWheelEventTime = 0;
        }

        const startingZoom = () => {
            return (tr._terrainEnabled() && this._aroundCoord) ? tr.computeZoomRelativeTo(this._aroundCoord) : tr.zoom;
        };

        // if we've had scroll events since the last render frame, consume the
        // accumulated delta, and update the target zoom level accordingly
        if (this._delta !== 0) {
            // For trackpad events and single mouse wheel ticks, use the default zoom rate
            const zoomRate = (this._type === 'wheel' && Math.abs(this._delta) > wheelZoomDelta) ? this._wheelZoomRate : this._defaultZoomRate;
            // Scale by sigmoid of scroll wheel delta.
            let scale = maxScalePerFrame / (1 + Math.exp(-Math.abs(this._delta * zoomRate)));

            if (this._delta < 0 && scale !== 0) {
                scale = 1 / scale;
            }

            const startZoom = startingZoom();
            const startScale = Math.pow(2.0, startZoom);

            const fromScale = typeof this._targetZoom === 'number' ? tr.zoomScale(this._targetZoom) : startScale;
            this._targetZoom = Math.min(tr.maxZoom, Math.max(tr.minZoom, tr.scaleZoom(fromScale * scale)));

            // if this is a mouse wheel, refresh the starting zoom and easing
            // function we're using to smooth out the zooming between wheel
            // events
            if (this._type === 'wheel') {
                this._startZoom = startZoom;
                this._easing = this._smoothOutEasing(200);
            }
            this._lastDelta = this._delta;
            this._delta = 0;
        }
        const targetZoom = typeof this._targetZoom === 'number' ?
            this._targetZoom : startingZoom();
        const startZoom = this._startZoom;
        const easing = this._easing;

        let finished = false;
        let zoom;
        if (this._type === 'wheel' && startZoom && easing) {
            assert(easing && typeof startZoom === 'number');

            const t = Math.min((browser.now() - this._lastWheelEventTime) / 200, 1);
            const k = easing(t);
            zoom = interpolate(startZoom, targetZoom, k);
            if (t < 1) {
                if (!this._frameId) {
                    this._frameId = true;
                }
            } else {
                finished = true;
            }
        } else {
            zoom = targetZoom;
            finished = true;
        }

        this._active = true;

        if (finished) {
            this._active = false;
            this._finishTimeout = setTimeout(() => {
                this._zooming = false;
                this._handler._triggerRenderFrame();
                delete this._targetZoom;
                delete this._finishTimeout;
            }, 200);
        }

        let zoomDelta = zoom - startingZoom();
        if (zoomDelta * this._lastDelta < 0) {
            // prevent recenter zoom in opposite direction from zoom
            zoomDelta = 0;
        }
        return {
            noInertia: true,
            needsRenderFrame: !finished,
            zoomDelta,
            around: this._aroundPoint,
            aroundCoord: this._aroundCoord,
            originalEvent: this._lastWheelEvent
        };
    }

    _smoothOutEasing(duration: number): (number) => number {
        let easing = _ease;

        if (this._prevEase) {
            const ease = this._prevEase,
                t = (browser.now() - ease.start) / ease.duration,
                speed = ease.easing(t + 0.01) - ease.easing(t),

                // Quick hack to make new bezier that is continuous with last
                x = 0.27 / Math.sqrt(speed * speed + 0.0001) * 0.01,
                y = Math.sqrt(0.27 * 0.27 - x * x);

            easing = bezier(x, y, 0.25, 1);
        }

        this._prevEase = {
            start: browser.now(),
            duration,
            easing
        };

        return easing;
    }

    blur() {
        this.reset();
    }

    reset() {
        this._active = false;
    }

    _addScrollZoomBlocker() {
        if (this._map && !this._alertContainer) {
            this._alertContainer = DOM.create('div', 'mapboxgl-scroll-zoom-blocker', this._map._container);

            if (/(Mac|iPad)/i.test(navigator.userAgent)) {
                this._alertContainer.textContent = this._map._getUIString('ScrollZoomBlocker.CmdMessage');
            } else {
                this._alertContainer.textContent = this._map._getUIString('ScrollZoomBlocker.CtrlMessage');
            }

            // dynamically set the font size of the scroll zoom blocker alert message
            this._alertContainer.style.fontSize = `${Math.max(10, Math.min(24, Math.floor(this._el.clientWidth * 0.05)))}px`;
        }
    }

    _showBlockerAlert() {
        this._alertContainer.style.visibility = 'visible';
        this._alertContainer.classList.add('mapboxgl-scroll-zoom-blocker-show');
        this._alertContainer.setAttribute("role", "alert");

        clearTimeout(this._alertTimer);

        this._alertTimer = setTimeout(() => {
            this._alertContainer.classList.remove('mapboxgl-scroll-zoom-blocker-show');
            this._alertContainer.removeAttribute("role");
        }, 200);
    }

}

export default ScrollZoomHandler;
