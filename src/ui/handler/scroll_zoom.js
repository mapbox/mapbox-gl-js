'use strict';

const DOM = require('../../util/dom');
const util = require('../../util/util');
const browser = require('../../util/browser');
const window = require('../../util/window');

const ua = window.navigator.userAgent.toLowerCase(),
    firefox = ua.indexOf('firefox') !== -1,
    safari = ua.indexOf('safari') !== -1 && ua.indexOf('chrom') === -1;

/**
 * The `ScrollZoomHandler` allows the user to zoom the map by scrolling.
 *
 * @param {Map} map The Mapbox GL JS map to add the handler to.
 */
class ScrollZoomHandler {
    constructor(map) {
        this._map = map;
        this._el = map.getCanvasContainer();

        util.bindAll([
            '_onWheel',
            '_onTimeout'
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
    enable(options) {
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

    _onWheel(e) {
        let value;

        if (e.type === 'wheel') {
            value = e.deltaY;
            // Firefox doubles the values on retina screens...
            if (firefox && e.deltaMode === window.WheelEvent.DOM_DELTA_PIXEL) value /= browser.devicePixelRatio;
            if (e.deltaMode === window.WheelEvent.DOM_DELTA_LINE) value *= 40;

        } else if (e.type === 'mousewheel') {
            value = -e.wheelDeltaY;
            if (safari) value = value / 3;
        }

        const now = browser.now(),
            timeDelta = now - (this._time || 0);

        this._pos = DOM.mousePos(this._el, e);
        this._time = now;

        if (value !== 0 && (value % 4.000244140625) === 0) {
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
            this._timeout = setTimeout(this._onTimeout, 40);

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
        if (this._type) this._zoom(-value, e);

        e.preventDefault();
    }

    _onTimeout() {
        this._type = 'wheel';
        this._zoom(-this._lastValue);
    }

    _zoom(delta, e) {
        if (delta === 0) return;
        const map = this._map;

        // Scale by sigmoid of scroll wheel delta.
        let scale = 2 / (1 + Math.exp(-Math.abs(delta / 100)));
        if (delta < 0 && scale !== 0) scale = 1 / scale;

        const fromScale = map.ease ? map.ease.to : map.transform.scale,
            targetZoom = map.transform.scaleZoom(fromScale * scale);

        map.zoomTo(targetZoom, {
            duration: this._type === 'wheel' ? 200 : 0,
            around: this._aroundCenter ? map.getCenter() : map.unproject(this._pos),
            delayEndEvents: 200,
            smoothEasing: true
        }, { originalEvent: e });
    }
}

module.exports = ScrollZoomHandler;

/**
 * Fired just before the map begins a transition from one zoom level to another,
 * as the result of either user interaction or methods such as [Map#flyTo](#Map#flyTo).
 *
 * @event zoomstart
 * @memberof Map
 * @instance
 * @property {MapMouseEvent | MapTouchEvent} data
 */

/**
 * Fired repeatedly during an animated transition from one zoom level to another,
 * as the result of either user interaction or methods such as [Map#flyTo](#Map#flyTo).
 *
 * @event zoom
 * @memberof Map
 * @instance
 * @property {MapMouseEvent | MapTouchEvent} data
 * @see [Update a choropleth layer by zoom level](https://www.mapbox.com/mapbox-gl-js/example/updating-choropleth/)
 */

/**
 * Fired just after the map completes a transition from one zoom level to another,
 * as the result of either user interaction or methods such as [Map#flyTo](#Map#flyTo).
 *
 * @event zoomend
 * @memberof Map
 * @instance
 * @property {MapMouseEvent | MapTouchEvent} data
 */
