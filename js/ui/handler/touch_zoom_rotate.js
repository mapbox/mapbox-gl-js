'use strict';

var DOM = require('../../util/dom'),
    util = require('../../util/util');

module.exports = TouchZoomRotateHandler;

var inertiaLinearity = 0.15,
    inertiaEasing = util.bezier(0, 0, inertiaLinearity, 1),
    inertiaDeceleration = 12, // scale / s^2
    inertiaMaxSpeed = 2.5, // scale / s
    significantScaleThreshold = 0.15,
    significantRotateThreshold = 4;


/**
 * The `TouchZoomRotateHandler` allows the user to zoom and rotate the map by
 * pinching on a touchscreen.
 *
 * @class TouchZoomRotateHandler
 * @param {Map} map The Mapbox GL JS map to add the handler to.
 */
function TouchZoomRotateHandler(map) {
    this._map = map;
    this._el = map.getCanvasContainer();

    util.bindHandlers(this);
}

TouchZoomRotateHandler.prototype = {

    _enabled: false,

    /**
     * Returns a Boolean indicating whether the "pinch to rotate and zoom" interaction is enabled.
     *
     * @returns {boolean} `true` if the "pinch to rotate and zoom" interaction is enabled.
     */
    isEnabled: function () {
        return this._enabled;
    },

    /**
     * Enables the "pinch to rotate and zoom" interaction.
     *
     * @example
     *   map.touchZoomRotate.enable();
     */
    enable: function () {
        if (this.isEnabled()) return;
        this._el.addEventListener('touchstart', this._onStart, false);
        this._enabled = true;
    },

    /**
     * Disables the "pinch to rotate and zoom" interaction.
     *
     * @example
     *   map.touchZoomRotate.disable();
     */
    disable: function () {
        if (!this.isEnabled()) return;
        this._el.removeEventListener('touchstart', this._onStart);
        this._enabled = false;
    },

    /**
     * Disables the "pinch to rotate" interaction, leaving the "pinch to zoom"
     * interaction enabled.
     *
     * @example
     *   map.touchZoomRotate.disableRotation();
     */
    disableRotation: function() {
        this._rotationDisabled = true;
    },

    /**
     * Enables the "pinch to rotate" interaction.
     *
     * @example
     *   map.touchZoomRotate.enable();
     *   map.touchZoomRotate.enableRotation();
     */
    enableRotation: function() {
        this._rotationDisabled = false;
    },

    _onStart: function (e) {
        if (e.touches.length !== 2) return;

        var p0 = DOM.mousePos(this._el, e.touches[0]),
            p1 = DOM.mousePos(this._el, e.touches[1]);

        this._startVec = p0.sub(p1);
        this._startScale = this._map.transform.scale;
        this._startBearing = this._map.transform.bearing;
        this._gestureIntent = undefined;
        this._inertia = [];

        document.addEventListener('touchmove', this._onMove, false);
        document.addEventListener('touchend', this._onEnd, false);
    },

    _onMove: function (e) {
        if (e.touches.length !== 2) return;

        var p0 = DOM.mousePos(this._el, e.touches[0]),
            p1 = DOM.mousePos(this._el, e.touches[1]),
            p = p0.add(p1).div(2),
            vec = p0.sub(p1),
            scale = vec.mag() / this._startVec.mag(),
            bearing = this._rotationDisabled ? 0 : vec.angleWith(this._startVec) * 180 / Math.PI,
            map = this._map;

        // Determine 'intent' by whichever threshold is surpassed first,
        // then keep that state for the duration of this gesture.
        if (!this._gestureIntent) {
            var scalingSignificantly = (Math.abs(1 - scale) > significantScaleThreshold),
                rotatingSignificantly = (Math.abs(bearing) > significantRotateThreshold);

            if (rotatingSignificantly) {
                this._gestureIntent = 'rotate';
            } else if (scalingSignificantly) {
                this._gestureIntent = 'zoom';
            }

            if (this._gestureIntent) {
                this._startVec = vec;
                this._startScale = map.transform.scale;
                this._startBearing = map.transform.bearing;
            }

        } else {
            var param = { duration: 0, around: map.unproject(p) };

            if (this._gestureIntent === 'rotate') {
                param.bearing = this._startBearing + bearing;
            }
            if (this._gestureIntent === 'zoom' || this._gestureIntent === 'rotate') {
                param.zoom = map.transform.scaleZoom(this._startScale * scale);
            }

            map.stop();
            this._drainInertiaBuffer();
            this._inertia.push([Date.now(), scale, p]);

            map.easeTo(param, { originalEvent: e });
        }

        e.preventDefault();
    },

    _onEnd: function (e) {
        document.removeEventListener('touchmove', this._onMove);
        document.removeEventListener('touchend', this._onEnd);
        this._drainInertiaBuffer();

        var inertia = this._inertia,
            map = this._map;

        if (inertia.length < 2) {
            map.snapToNorth({}, { originalEvent: e });
            return;
        }

        var last = inertia[inertia.length - 1],
            first = inertia[0],
            lastScale = map.transform.scaleZoom(this._startScale * last[1]),
            firstScale = map.transform.scaleZoom(this._startScale * first[1]),
            scaleOffset = lastScale - firstScale,
            scaleDuration = (last[0] - first[0]) / 1000,
            p = last[2];

        if (scaleDuration === 0 || lastScale === firstScale) {
            map.snapToNorth({}, { originalEvent: e });
            return;
        }

        // calculate scale/s speed and adjust for increased initial animation speed when easing
        var speed = scaleOffset * inertiaLinearity / scaleDuration; // scale/s

        if (Math.abs(speed) > inertiaMaxSpeed) {
            if (speed > 0) {
                speed = inertiaMaxSpeed;
            } else {
                speed = -inertiaMaxSpeed;
            }
        }

        var duration = Math.abs(speed / (inertiaDeceleration * inertiaLinearity)) * 1000,
            targetScale = lastScale + speed * duration / 2000;

        if (targetScale < 0) {
            targetScale = 0;
        }

        map.easeTo({
            zoom: targetScale,
            duration: duration,
            easing: inertiaEasing,
            around: map.unproject(p)
        }, { originalEvent: e });
    },

    _drainInertiaBuffer: function() {
        var inertia = this._inertia,
            now = Date.now(),
            cutoff = 160; // msec

        while (inertia.length > 2 && now - inertia[0][0] > cutoff) inertia.shift();
    }
};
