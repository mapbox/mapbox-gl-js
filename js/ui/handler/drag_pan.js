'use strict';

var DOM = require('../../util/dom'),
    util = require('../../util/util');

module.exports = DragPanHandler;

var inertiaLinearity = 0.3,
    inertiaEasing = util.bezier(0, 0, inertiaLinearity, 1),
    inertiaMaxSpeed = 1400, // px/s
    inertiaDeceleration = 2500; // px/s^2


/**
 * The `DragPanHandler` allows the user to pan the map by clicking and dragging
 * the cursor.
 *
 * @class DragPanHandler
 * @param {Map} map The Mapbox GL JS map to add the handler to.
 */
function DragPanHandler(map) {
    this._map = map;
    this._el = map.getCanvasContainer();

    util.bindHandlers(this);
}

DragPanHandler.prototype = {

    _enabled: false,
    _active: false,

    /**
     * Returns a Boolean indicating whether the "drag to pan" interaction is enabled.
     *
     * @returns {boolean} `true` if the "drag to pan" interaction is enabled.
     */
    isEnabled: function () {
        return this._enabled;
    },

    /**
     * Returns a Boolean indicating whether the "drag to pan" interaction is active, i.e. currently being used.
     *
     * @returns {boolean} `true` if the "drag to pan" interaction is active.
     */
    isActive: function () {
        return this._active;
    },

    /**
     * Enables the "drag to pan" interaction.
     *
     * @example
     * map.dragPan.enable();
     */
    enable: function () {
        if (this.isEnabled()) return;
        this._el.addEventListener('mousedown', this._onDown);
        this._el.addEventListener('touchstart', this._onDown);
        this._enabled = true;
    },

    /**
     * Disables the "drag to pan" interaction.
     *
     * @example
     * map.dragPan.disable();
     */
    disable: function () {
        if (!this.isEnabled()) return;
        this._el.removeEventListener('mousedown', this._onDown);
        this._el.removeEventListener('touchstart', this._onDown);
        this._enabled = false;
    },

    _onDown: function (e) {
        if (this._ignoreEvent(e)) return;
        if (this.isActive()) return;

        if (e.touches) {
            document.addEventListener('touchmove', this._onMove);
            document.addEventListener('touchend', this._onTouchEnd);
        } else {
            document.addEventListener('mousemove', this._onMove);
            document.addEventListener('mouseup', this._onMouseUp);
        }

        this._active = false;
        this._startPos = this._pos = DOM.mousePos(this._el, e);
        this._inertia = [[Date.now(), this._pos]];
    },

    _onMove: function (e) {
        if (this._ignoreEvent(e)) return;

        if (!this.isActive()) {
            this._active = true;
            this._fireEvent('dragstart', e);
            this._fireEvent('movestart', e);
        }

        var pos = DOM.mousePos(this._el, e),
            map = this._map;

        map.stop();
        this._drainInertiaBuffer();
        this._inertia.push([Date.now(), pos]);

        map.transform.setLocationAtPoint(map.transform.pointLocation(this._pos), pos);

        this._fireEvent('drag', e);
        this._fireEvent('move', e);

        this._pos = pos;

        e.preventDefault();
    },

    _onUp: function (e) {
        if (!this.isActive()) return;

        this._active = false;
        this._fireEvent('dragend', e);
        this._drainInertiaBuffer();

        var finish = function() {
            this._fireEvent('moveend', e);
        }.bind(this);

        var inertia = this._inertia;
        if (inertia.length < 2) {
            finish();
            return;
        }

        var last = inertia[inertia.length - 1],
            first = inertia[0],
            flingOffset = last[1].sub(first[1]),
            flingDuration = (last[0] - first[0]) / 1000;

        if (flingDuration === 0 || last[1].equals(first[1])) {
            finish();
            return;
        }

        // calculate px/s velocity & adjust for increased initial animation speed when easing out
        var velocity = flingOffset.mult(inertiaLinearity / flingDuration),
            speed = velocity.mag(); // px/s

        if (speed > inertiaMaxSpeed) {
            speed = inertiaMaxSpeed;
            velocity._unit()._mult(speed);
        }

        var duration = speed / (inertiaDeceleration * inertiaLinearity),
            offset = velocity.mult(-duration / 2);

        this._map.panBy(offset, {
            duration: duration * 1000,
            easing: inertiaEasing,
            noMoveStart: true
        }, { originalEvent: e });
    },

    _onMouseUp: function (e) {
        if (this._ignoreEvent(e)) return;
        this._onUp(e);
        document.removeEventListener('mousemove', this._onMove);
        document.removeEventListener('mouseup', this._onMouseUp);
    },

    _onTouchEnd: function (e) {
        if (this._ignoreEvent(e)) return;
        this._onUp(e);
        document.removeEventListener('touchmove', this._onMove);
        document.removeEventListener('touchend', this._onTouchEnd);
    },

    _fireEvent: function (type, e) {
        return this._map.fire(type, { originalEvent: e });
    },

    _ignoreEvent: function (e) {
        var map = this._map;

        if (map.boxZoom && map.boxZoom.isActive()) return true;
        if (map.dragRotate && map.dragRotate.isActive()) return true;
        if (e.touches) {
            return (e.touches.length > 1);
        } else {
            if (e.ctrlKey) return true;
            var buttons = 1,  // left button
                button = 0;   // left button
            return (e.type === 'mousemove' ? e.buttons & buttons === 0 : e.button !== button);
        }
    },

    _drainInertiaBuffer: function () {
        var inertia = this._inertia,
            now = Date.now(),
            cutoff = 160;   // msec

        while (inertia.length > 0 && now - inertia[0][0] > cutoff) inertia.shift();
    }
};


/**
 * Fired when a "drag to pan" interaction starts. See [`DragPanHandler`](#DragPanHandler).
 *
 * @event dragstart
 * @memberof Map
 * @instance
 * @property {MapMouseEvent | MapTouchEvent} data
 */

/**
 * Fired repeatedly during a "drag to pan" interaction. See [`DragPanHandler`](#DragPanHandler).
 *
 * @event drag
 * @memberof Map
 * @instance
 * @property {MapMouseEvent | MapTouchEvent} data
 */

/**
 * Fired when a "drag to pan" interaction ends. See [`DragPanHandler`](#DragPanHandler).
 *
 * @event dragend
 * @memberof Map
 * @instance
 * @property {MapMouseEvent | MapTouchEvent} data
 */
