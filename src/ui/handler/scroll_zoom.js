// @flow

import assert from 'assert';
import DOM from '../../util/dom';

import {ease as _ease, bindAll, bezier} from '../../util/util';
import browser from '../../util/browser';
import window from '../../util/window';
import {number as interpolate} from '../../style-spec/util/interpolate';
import Point from '@mapbox/point-geometry';

import type Map from '../map';
import type HandlerManager from '../handler_manager';
import MercatorCoordinate from '../../geo/mercator_coordinate';

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
 */
class ScrollZoomHandler {
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
    _easing: ?((number) => number);
    _prevEase: ?{start: number, duration: number, easing: (_: number) => number};

    _frameId: ?boolean;
    _handler: HandlerManager;

    _defaultZoomRate: number;
    _wheelZoomRate: number;

    /**
     * @private
     */
    constructor(map: Map, handler: HandlerManager) {
        this._map = map;
        this._el = map.getCanvasContainer();
        this._handler = handler;

        this._delta = 0;

        this._defaultZoomRate = defaultZoomRate;
        this._wheelZoomRate = wheelZoomRate;

        bindAll(['_onTimeout'], this);
    }

    /**
     * Set the zoom rate of a trackpad
     * @param {number} [zoomRate=1/100] The rate used to scale trackpad movement to a zoom value.
     * @example
     * // Speed up trackpad zoom
     * map.scrollZoom.setZoomRate(1/25);
     */
    setZoomRate(zoomRate: number) {
        this._defaultZoomRate = zoomRate;
    }

    /**
    * Set the zoom rate of a mouse wheel
    * @param {number} [wheelZoomRate=1/450] The rate used to scale mouse wheel movement to a zoom value.
    * @example
    * // Slow down zoom of mouse wheel
    * map.scrollZoom.setWheelZoomRate(1/600);
    */
    setWheelZoomRate(wheelZoomRate: number) {
        this._wheelZoomRate = wheelZoomRate;
    }

    /**
     * Returns a Boolean indicating whether the "scroll to zoom" interaction is enabled.
     *
     * @returns {boolean} `true` if the "scroll to zoom" interaction is enabled.
     */
    isEnabled() {
        return !!this._enabled;
    }

    /*
    * Active state is turned on and off with every scroll wheel event and is set back to false before the map
    * render is called, so _active is not a good candidate for determining if a scroll zoom animation is in
    * progress.
    */
    isActive() {
        return !!this._active || this._finishTimeout !== undefined;
    }

    isZooming() {
        return !!this._zooming;
    }

    /**
     * Enables the "scroll to zoom" interaction.
     *
     * @param {Object} [options] Options object.
     * @param {string} [options.around] If "center" is passed, map will zoom around center of map
     *
     * @example
     *   map.scrollZoom.enable();
     * @example
     *  map.scrollZoom.enable({ around: 'center' })
     */
    enable(options: any) {
        if (this.isEnabled()) return;
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
        this._enabled = false;
    }

    wheel(e: WheelEvent) {
        if (!this.isEnabled()) return;

        // Remove `any` cast when https://github.com/facebook/flow/issues/4879 is fixed.
        let value = e.deltaMode === (window.WheelEvent: any).DOM_DELTA_LINE ? e.deltaY * 40 : e.deltaY;
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
            if (!this._active) {
                this._start(e);
            }
        }

        e.preventDefault();
    }

    _onTimeout(initialEvent: any) {
        this._type = 'wheel';
        this._delta -= this._lastValue;
        if (!this._active) {
            this._start(initialEvent);
        }
    }

    _start(e: any) {
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

    renderFrame() {
        if (!this._frameId) return;
        this._frameId = null;

        if (!this.isActive()) return;
        const tr = this._map.transform;

        const startingZoom = () => {
            return tr._terrainEnabled() ? tr.computeZoomRelativeTo(this._aroundCoord) : tr.zoom;
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
                this._startZoom = startingZoom();
                this._easing = this._smoothOutEasing(200);
            }

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

        return {
            noInertia: true,
            needsRenderFrame: !finished,
            zoomDelta: zoom - startingZoom(),
            around: this._aroundPoint,
            aroundCoord: this._aroundCoord,
            originalEvent: this._lastWheelEvent
        };
    }

    _smoothOutEasing(duration: number) {
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

    reset() {
        this._active = false;
    }
}

export default ScrollZoomHandler;
