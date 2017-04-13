'use strict';

const DOM = require('../../util/dom');
const util = require('../../util/util');
const window = require('../../util/window');

const inertiaLinearity = 0.3,
    inertiaEasing = util.bezier(0, 0, inertiaLinearity, 1),
    inertiaMaxSpeed = 1400, // px/s
    inertiaDeceleration = 2500; // px/s^2

/**
 * The `DragPanHandler` allows the user to pan the map by clicking and dragging
 * the cursor.
 *
 * @param {Map} map The Mapbox GL JS map to add the handler to.
 */
class DragPanHandler {
    constructor(map) {
        this._map = map;
        this._el = map.getCanvasContainer();

        util.bindAll([
            '_onDown',
            '_onMove',
            '_onUp',
            '_onTouchEnd',
            '_onMouseUp'
        ], this);
    }

    /**
     * Returns a Boolean indicating whether the "drag to pan" interaction is enabled.
     *
     * @returns {boolean} `true` if the "drag to pan" interaction is enabled.
     */
    isEnabled() {
        return !!this._enabled;
    }

    /**
     * Returns a Boolean indicating whether the "drag to pan" interaction is active, i.e. currently being used.
     *
     * @returns {boolean} `true` if the "drag to pan" interaction is active.
     */
    isActive() {
        return !!this._active;
    }

    /**
     * Enables the "drag to pan" interaction.
     *
     * @example
     * map.dragPan.enable();
     */
    enable() {
        if (this.isEnabled()) return;
        this._el.classList.add('mapboxgl-touch-drag-pan');
        this._el.addEventListener('mousedown', this._onDown);
        this._el.addEventListener('touchstart', this._onDown);
        this._enabled = true;
    }

    /**
     * Disables the "drag to pan" interaction.
     *
     * @example
     * map.dragPan.disable();
     */
    disable() {
        if (!this.isEnabled()) return;
        this._el.classList.remove('mapboxgl-touch-drag-pan');
        this._el.removeEventListener('mousedown', this._onDown);
        this._el.removeEventListener('touchstart', this._onDown);
        this._enabled = false;
    }

    _onDown(e) {
        if (this._ignoreEvent(e)) return;
        if (this.isActive()) return;

        if (e.touches) {
            window.document.addEventListener('touchmove', this._onMove);
            window.document.addEventListener('touchend', this._onTouchEnd);
        } else {
            window.document.addEventListener('mousemove', this._onMove);
            window.document.addEventListener('mouseup', this._onMouseUp);
        }
        /* Deactivate DragPan when the window looses focus. Otherwise if a mouseup occurs when the window isn't in focus, DragPan will still be active even though the mouse is no longer pressed. */
        window.addEventListener('blur', this._onMouseUp);

        this._active = false;
        this._startPos = this._pos = DOM.mousePos(this._el, e);
        this._inertia = [[Date.now(), this._pos]];
    }

    _onMove(e) {
        if (this._ignoreEvent(e)) return;

        if (!this.isActive()) {
            this._active = true;
            this._map.moving = true;
            this._fireEvent('dragstart', e);
            this._fireEvent('movestart', e);
        }

        const pos = DOM.mousePos(this._el, e),
            map = this._map;

        map.stop();
        this._drainInertiaBuffer();
        this._inertia.push([Date.now(), pos]);

        map.transform.setLocationAtPoint(map.transform.pointLocation(this._pos), pos);

        this._fireEvent('drag', e);
        this._fireEvent('move', e);

        this._pos = pos;

        e.preventDefault();
    }

    _onUp(e) {
        if (!this.isActive()) return;

        this._active = false;
        this._fireEvent('dragend', e);
        this._drainInertiaBuffer();

        const finish = () => {
            this._map.moving = false;
            this._fireEvent('moveend', e);
        };

        const inertia = this._inertia;
        if (inertia.length < 2) {
            finish();
            return;
        }

        const last = inertia[inertia.length - 1],
            first = inertia[0],
            flingOffset = last[1].sub(first[1]),
            flingDuration = (last[0] - first[0]) / 1000;

        if (flingDuration === 0 || last[1].equals(first[1])) {
            finish();
            return;
        }

        // calculate px/s velocity & adjust for increased initial animation speed when easing out
        const velocity = flingOffset.mult(inertiaLinearity / flingDuration);
        let speed = velocity.mag(); // px/s

        if (speed > inertiaMaxSpeed) {
            speed = inertiaMaxSpeed;
            velocity._unit()._mult(speed);
        }

        const duration = speed / (inertiaDeceleration * inertiaLinearity),
            offset = velocity.mult(-duration / 2);

        this._map.panBy(offset, {
            duration: duration * 1000,
            easing: inertiaEasing,
            noMoveStart: true
        }, { originalEvent: e });
    }

    _onMouseUp(e) {
        if (this._ignoreEvent(e)) return;
        this._onUp(e);
        window.document.removeEventListener('mousemove', this._onMove);
        window.document.removeEventListener('mouseup', this._onMouseUp);
        window.removeEventListener('blur', this._onMouseUp);
    }

    _onTouchEnd(e) {
        if (this._ignoreEvent(e)) return;
        this._onUp(e);
        window.document.removeEventListener('touchmove', this._onMove);
        window.document.removeEventListener('touchend', this._onTouchEnd);
    }

    _fireEvent(type, e) {
        return this._map.fire(type, { originalEvent: e });
    }

    _ignoreEvent(e) {
        const map = this._map;

        if (map.boxZoom && map.boxZoom.isActive()) return true;
        if (map.dragRotate && map.dragRotate.isActive()) return true;
        if (e.touches) {
            return (e.touches.length > 1);
        } else {
            if (e.ctrlKey) return true;
            const buttons = 1,  // left button
                button = 0;   // left button
            return (e.type === 'mousemove' ? e.buttons & buttons === 0 : e.button && e.button !== button);
        }
    }

    _drainInertiaBuffer() {
        const inertia = this._inertia,
            now = Date.now(),
            cutoff = 160;   // msec

        while (inertia.length > 0 && now - inertia[0][0] > cutoff) inertia.shift();
    }
}

module.exports = DragPanHandler;

/**
 * Fired when a "drag to pan" interaction starts. See [`DragPanHandler`](#DragPanHandler).
 *
 * @event dragstart
 * @memberof Map
 * @instance
 * @property {{originalEvent: DragEvent}} data
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
 * @property {{originalEvent: DragEvent}} data
 */
