'use strict';

var DOM = require('../../util/dom'),
    Point = require('point-geometry'),
    util = require('../../util/util');

module.exports = DragRotateHandler;

var inertiaLinearity = 0.25,
    inertiaEasing = util.bezier(0, 0, inertiaLinearity, 1),
    inertiaMaxSpeed = 180, // deg/s
    inertiaDeceleration = 720; // deg/s^2


/**
 * The `DragRotateHandler` allows the user to rotate the map by clicking and
 * dragging the cursor while holding the right mouse button or `ctrl` key.
 *
 * @class DragRotateHandler
 * @param {Map} map The Mapbox GL JS map to add the handler to.
 * @param {Object} [options]
 * @param {number} [options.bearingSnap] The threshold, measured in degrees, that determines when the map's
 *   bearing (rotation) will snap to north.
 */
function DragRotateHandler(map, options) {
    this._map = map;
    this._el = map.getCanvasContainer();
    this._bearingSnap = options.bearingSnap;

    util.bindHandlers(this);
}

DragRotateHandler.prototype = {

    _enabled: false,
    _active: false,

    /**
     * Returns a Boolean indicating whether the "drag to rotate" interaction is enabled.
     *
     * @returns {boolean} `true` if the "drag to rotate" interaction is enabled.
     */
    isEnabled: function () {
        return this._enabled;
    },

    /**
     * Returns a Boolean indicating whether the "drag to rotate" interaction is active, i.e. currently being used.
     *
     * @returns {boolean} `true` if the "drag to rotate" interaction is active.
     */
    isActive: function () {
        return this._active;
    },

    /**
     * Enables the "drag to rotate" interaction.
     *
     * @example
     * map.dragRotate.enable();
     */
    enable: function () {
        if (this.isEnabled()) return;
        this._el.addEventListener('mousedown', this._onDown);
        this._enabled = true;
    },

    /**
     * Disables the "drag to rotate" interaction.
     *
     * @example
     * map.dragRotate.disable();
     */
    disable: function () {
        if (!this.isEnabled()) return;
        this._el.removeEventListener('mousedown', this._onDown);
        this._enabled = false;
    },

    _onDown: function (e) {
        if (this._ignoreEvent(e)) return;
        if (this.isActive()) return;

        document.addEventListener('mousemove', this._onMove);
        document.addEventListener('mouseup', this._onUp);

        this._active = false;
        this._inertia = [[Date.now(), this._map.getBearing()]];
        this._startPos = this._pos = DOM.mousePos(this._el, e);
        this._center = this._map.transform.centerPoint;  // Center of rotation

        // If the first click was too close to the center, move the center of rotation by 200 pixels
        // in the direction of the click.
        var startToCenter = this._startPos.sub(this._center),
            startToCenterDist = startToCenter.mag();

        if (startToCenterDist < 200) {
            this._center = this._startPos.add(new Point(-200, 0)._rotate(startToCenter.angle()));
        }

        e.preventDefault();
    },

    _onMove: function (e) {
        if (this._ignoreEvent(e)) return;

        if (!this.isActive()) {
            this._active = true;
            this._fireEvent('rotatestart', e);
            this._fireEvent('movestart', e);
        }

        var map = this._map;
        map.stop();

        var p1 = this._pos,
            p2 = DOM.mousePos(this._el, e),
            center = this._center,
            bearingDiff = p1.sub(center).angleWith(p2.sub(center)) / Math.PI * 180,
            bearing = map.getBearing() - bearingDiff,
            inertia = this._inertia,
            last = inertia[inertia.length - 1];

        this._drainInertiaBuffer();
        inertia.push([Date.now(), map._normalizeBearing(bearing, last[1])]);

        map.transform.bearing = bearing;

        this._fireEvent('rotate', e);
        this._fireEvent('move', e);

        this._pos = p2;
    },

    _onUp: function (e) {
        if (this._ignoreEvent(e)) return;
        document.removeEventListener('mousemove', this._onMove);
        document.removeEventListener('mouseup', this._onUp);

        if (!this.isActive()) return;

        this._active = false;
        this._fireEvent('rotateend', e);
        this._drainInertiaBuffer();

        var map = this._map,
            mapBearing = map.getBearing(),
            inertia = this._inertia;

        var finish = function() {
            if (Math.abs(mapBearing) < this._bearingSnap) {
                map.resetNorth({noMoveStart: true}, { originalEvent: e });
            } else {
                this._fireEvent('moveend', e);
            }
        }.bind(this);

        if (inertia.length < 2) {
            finish();
            return;
        }

        var first = inertia[0],
            last = inertia[inertia.length - 1],
            previous = inertia[inertia.length - 2],
            bearing = map._normalizeBearing(mapBearing, previous[1]),
            flingDiff = last[1] - first[1],
            sign = flingDiff < 0 ? -1 : 1,
            flingDuration = (last[0] - first[0]) / 1000;

        if (flingDiff === 0 || flingDuration === 0) {
            finish();
            return;
        }

        var speed = Math.abs(flingDiff * (inertiaLinearity / flingDuration));  // deg/s
        if (speed > inertiaMaxSpeed) {
            speed = inertiaMaxSpeed;
        }

        var duration = speed / (inertiaDeceleration * inertiaLinearity),
            offset = sign * speed * (duration / 2);

        bearing += offset;

        if (Math.abs(map._normalizeBearing(bearing, 0)) < this._bearingSnap) {
            bearing = map._normalizeBearing(0, bearing);
        }

        map.rotateTo(bearing, {
            duration: duration * 1000,
            easing: inertiaEasing,
            noMoveStart: true
        }, { originalEvent: e });
    },

    _fireEvent: function (type, e) {
        return this._map.fire(type, { originalEvent: e });
    },

    _ignoreEvent: function (e) {
        var map = this._map;

        if (map.boxZoom && map.boxZoom.isActive()) return true;
        if (map.dragPan && map.dragPan.isActive()) return true;
        if (e.touches) {
            return (e.touches.length > 1);
        } else {
            var buttons = (e.ctrlKey ? 1 : 2),  // ? ctrl+left button : right button
                button = (e.ctrlKey ? 0 : 2);   // ? ctrl+left button : right button
            return (e.type === 'mousemove' ? e.buttons & buttons === 0 : e.button !== button);
        }
    },

    _drainInertiaBuffer: function () {
        var inertia = this._inertia,
            now = Date.now(),
            cutoff = 160;   //msec

        while (inertia.length > 0 && now - inertia[0][0] > cutoff)
            inertia.shift();
    }

};


/**
 * Fired when a "drag to rotate" interaction starts. See [`DragRotateHandler`](#DragRotateHandler).
 *
 * @event rotatestart
 * @memberof Map
 * @instance
 * @property {MapMouseEvent | MapTouchEvent} data
 */

/**
 * Fired repeatedly during a "drag to rotate" interaction. See [`DragRotateHandler`](#DragRotateHandler).
 *
 * @event rotate
 * @memberof Map
 * @instance
 * @property {MapMouseEvent | MapTouchEvent} data
 */

/**
 * Fired when a "drag to rotate" interaction ends. See [`DragRotateHandler`](#DragRotateHandler).
 *
 * @event rotateend
 * @memberof Map
 * @instance
 * @property {MapMouseEvent | MapTouchEvent} data
 */
