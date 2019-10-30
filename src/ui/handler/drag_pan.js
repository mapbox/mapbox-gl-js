// @flow

import DOM from '../../util/dom';
import {bezier, bindAll} from '../../util/util';
import window from '../../util/window';
import browser from '../../util/browser';
import {Event} from '../../util/evented';
import assert from 'assert';

import type Map from '../map';
import type Point from '@mapbox/point-geometry';
import type {TaskID} from '../../util/task_queue';

const inertiaLinearity = 0.3,
    inertiaEasing = bezier(0, 0, inertiaLinearity, 1),
    inertiaMaxSpeed = 1400, // px/s
    inertiaDeceleration = 2500; // px/s^2

/**
 * The `DragPanHandler` allows the user to pan the map by clicking and dragging
 * the cursor.
 */
class DragPanHandler {
    _map: Map;
    _el: HTMLElement;
    _state: 'disabled' | 'enabled' | 'pending' | 'active';
    _startPos: Point;
    _mouseDownPos: Point;
    _prevPos: Point;
    _lastPos: Point;
    _startTouch: ?Array<Point>;
    _lastTouch: ?Array<Point>;
    _lastMoveEvent: MouseEvent | TouchEvent | void;
    _inertia: Array<[number, Point]>;
    _frameId: ?TaskID;
    _clickTolerance: number;
    _shouldStart: ?boolean;

    /**
     * @private
     */
    constructor(map: Map, options: {
        clickTolerance?: number
    }) {
        this._map = map;
        this._el = map.getCanvasContainer();
        this._state = 'disabled';
        this._clickTolerance = options.clickTolerance || 1;

        bindAll([
            '_onMove',
            '_onMouseUp',
            '_onTouchEnd',
            '_onBlur',
            '_onDragFrame'
        ], this);
    }

    /**
     * Returns a Boolean indicating whether the "drag to pan" interaction is enabled.
     *
     * @returns {boolean} `true` if the "drag to pan" interaction is enabled.
     */
    isEnabled() {
        return this._state !== 'disabled';
    }

    /**
     * Returns a Boolean indicating whether the "drag to pan" interaction is active, i.e. currently being used.
     *
     * @returns {boolean} `true` if the "drag to pan" interaction is active.
     */
    isActive() {
        return this._state === 'active';
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
        this._state = 'enabled';
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
        switch (this._state) {
        case 'active':
            this._state = 'disabled';
            this._unbind();
            this._deactivate();
            this._fireEvent('dragend');
            this._fireEvent('moveend');
            break;
        case 'pending':
            this._state = 'disabled';
            this._unbind();
            break;
        default:
            this._state = 'disabled';
            break;
        }
    }

    onMouseDown(e: MouseEvent) {
        if (this._state !== 'enabled') return;
        if (e.ctrlKey || DOM.mouseButton(e) !== 0) return;

        // Bind window-level event listeners for mousemove/up events. In the absence of
        // the pointer capture API, which is not supported by all necessary platforms,
        // window-level event listeners give us the best shot at capturing events that
        // fall outside the map canvas element. Use `{capture: true}` for the move event
        // to prevent map move events from being fired during a drag.
        DOM.addEventListener(window.document, 'mousemove', this._onMove, {capture: true});
        DOM.addEventListener(window.document, 'mouseup', this._onMouseUp);

        this._start(e);
    }

    onTouchStart(e: TouchEvent) {
        if (!this.isEnabled()) return;
        if (e.touches && e.touches.length > 1) { // multi-finger touch
            // If we are already dragging (e.g. with one finger) and add another finger,
            // keep the handler active but don't attempt to ._start() again
            if (this._state === 'pending' || this._state === 'active') return;
        }

        // Bind window-level event listeners for touchmove/end events. In the absence of
        // the pointer capture API, which is not supported by all necessary platforms,
        // window-level event listeners give us the best shot at capturing events that
        // fall outside the map canvas element. Use `{capture: true}` for the move event
        // to prevent map move events from being fired during a drag.
        DOM.addEventListener(window.document, 'touchmove', this._onMove, {capture: true, passive: false});
        DOM.addEventListener(window.document, 'touchend', this._onTouchEnd);

        this._start(e);
    }

    _start(e: MouseEvent | TouchEvent) {
        // Deactivate when the window loses focus. Otherwise if a mouseup occurs when the window
        // isn't in focus, dragging will continue even though the mouse is no longer pressed.
        window.addEventListener('blur', this._onBlur);

        this._state = 'pending';
        this._startPos = this._mouseDownPos = this._prevPos = this._lastPos = DOM.mousePos(this._el, e);
        this._startTouch = this._lastTouch = (window.TouchEvent && e instanceof window.TouchEvent) ? DOM.touchPos(this._el, e) : null;
        this._inertia = [[browser.now(), this._startPos]];
    }

    _touchesMatch(lastTouch: ?Array<Point>, thisTouch: ?Array<Point>) {
        if (!lastTouch || !thisTouch || lastTouch.length !== thisTouch.length) return false;
        return lastTouch.every((pos, i) => thisTouch[i] === pos);
    }

    _onMove(e: MouseEvent | TouchEvent) {
        e.preventDefault();

        const touchPos = (window.TouchEvent && e instanceof window.TouchEvent) ? DOM.touchPos(this._el, e) : null;
        const pos = DOM.mousePos(this._el, e);

        const matchesLastPos = touchPos ? this._touchesMatch(this._lastTouch, touchPos) : this._lastPos.equals(pos);

        if (matchesLastPos || (this._state === 'pending' && pos.dist(this._mouseDownPos) < this._clickTolerance)) {
            return;
        }

        this._lastMoveEvent = e;
        this._lastPos = pos;
        this._lastTouch = touchPos;
        this._drainInertiaBuffer();
        this._inertia.push([browser.now(), this._lastPos]);

        if (this._state === 'pending') {
            this._state = 'active';
            this._shouldStart = true;
        }

        if (!this._frameId) {
            this._frameId = this._map._requestRenderFrame(this._onDragFrame);
        }
    }

    /**
     * Called in each render frame while dragging is happening.
     * @private
     */
    _onDragFrame() {
        this._frameId = null;

        const e = this._lastMoveEvent;
        if (!e) return;

        if (this._map.touchZoomRotate.isActive()) {
            this._abort(e);
            return;
        }

        if (this._shouldStart) {
            // we treat the first drag frame (rather than the mousedown event)
            // as the start of the drag
            this._fireEvent('dragstart', e);
            this._fireEvent('movestart', e);
            this._shouldStart = false;
        }

        if (!this.isActive()) return; // It's possible for the dragstart event to trigger a disable() call (#2419) so we must account for that

        const tr = this._map.transform;
        tr.setLocationAtPoint(tr.pointLocation(this._prevPos), this._lastPos);
        this._fireEvent('drag', e);
        this._fireEvent('move', e);

        this._prevPos = this._lastPos;
        delete this._lastMoveEvent;
    }

    _onMouseUp(e: MouseEvent) {
        if (DOM.mouseButton(e) !== 0) return;
        switch (this._state) {
        case 'active':
            this._state = 'enabled';
            DOM.suppressClick();
            this._unbind();
            this._deactivate();
            this._inertialPan(e);
            break;
        case 'pending':
            this._state = 'enabled';
            this._unbind();
            break;
        default:
            assert(false);
            break;
        }
    }

    _onTouchEnd(e: TouchEvent) {
        if (!e.touches || e.touches.length === 0) { // only stop drag if all fingers have been removed
            switch (this._state) {
            case 'active':
                this._state = 'enabled';
                this._unbind();
                this._deactivate();
                this._inertialPan(e);
                break;
            case 'pending':
                this._state = 'enabled';
                this._unbind();
                break;
            case 'enabled':
                this._unbind();
                break;
            default:
                assert(false);
                break;
            }
        } else {  // some finger(s) still touching the screen
            switch (this._state) {
            case 'pending':
            case 'active':
                // we are already dragging; continue
                break;
            case 'enabled':
                // not currently dragging; get ready to start a new drag
                this.onTouchStart(e);
                break;
            default:
                assert(false);
                break;
            }
        }
    }

    _abort(e: FocusEvent | MouseEvent | TouchEvent) {
        switch (this._state) {
        case 'active':
            this._state = 'enabled';
            if (!this._shouldStart) { // If we scheduled the dragstart but never fired, nothing to end
                // We already started the drag, end it
                this._fireEvent('dragend', e);
                this._fireEvent('moveend', e);
            }
            this._unbind();
            this._deactivate();
            if ((window.TouchEvent && e instanceof window.TouchEvent) && e.touches.length > 1) {
                // If there are multiple fingers touching, reattach touchend listener in case
                // all but one finger is removed and we need to restart a drag on touchend
                DOM.addEventListener(window.document, 'touchend', this._onTouchEnd);
            }
            break;
        case 'pending':
            this._state = 'enabled';
            this._unbind();
            break;
        case 'enabled':
            this._unbind();
            break;
        default:
            assert(false);
            break;
        }
    }

    _onBlur(e: FocusEvent) {
        this._abort(e);
    }

    _unbind() {
        DOM.removeEventListener(window.document, 'touchmove', this._onMove, {capture: true, passive: false});
        DOM.removeEventListener(window.document, 'touchend', this._onTouchEnd);
        DOM.removeEventListener(window.document, 'mousemove', this._onMove, {capture: true});
        DOM.removeEventListener(window.document, 'mouseup', this._onMouseUp);
        DOM.removeEventListener(window, 'blur', this._onBlur);
    }

    _deactivate() {
        if (this._frameId) {
            this._map._cancelRenderFrame(this._frameId);
            this._frameId = null;
        }
        delete this._lastMoveEvent;
        delete this._startPos;
        delete this._prevPos;
        delete this._mouseDownPos;
        delete this._lastPos;
        delete this._startTouch;
        delete this._lastTouch;
        delete this._shouldStart;
    }

    _inertialPan(e: MouseEvent | TouchEvent) {
        this._fireEvent('dragend', e);

        this._drainInertiaBuffer();
        const inertia = this._inertia;
        if (inertia.length < 2) {
            this._fireEvent('moveend', e);
            return;
        }

        const last = inertia[inertia.length - 1],
            first = inertia[0],
            flingOffset = last[1].sub(first[1]),
            flingDuration = (last[0] - first[0]) / 1000;

        if (flingDuration === 0 || last[1].equals(first[1])) {
            this._fireEvent('moveend', e);
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
        }, {originalEvent: e});
    }

    _fireEvent(type: string, e: *) {
        return this._map.fire(new Event(type, e ? {originalEvent: e} : {}));
    }

    _drainInertiaBuffer() {
        const inertia = this._inertia,
            now = browser.now(),
            cutoff = 160;   // msec

        while (inertia.length > 0 && now - inertia[0][0] > cutoff) inertia.shift();
    }
}

export default DragPanHandler;
