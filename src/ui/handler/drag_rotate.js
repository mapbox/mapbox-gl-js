// @flow

const DOM = require('../../util/dom');
const util = require('../../util/util');
const window = require('../../util/window');
const browser = require('../../util/browser');
const {Event} = require('../../util/evented');

import type Map from '../map';
import type Point from '@mapbox/point-geometry';
import type Transform from '../../geo/transform';

const inertiaLinearity = 0.25,
    inertiaEasing = util.bezier(0, 0, inertiaLinearity, 1),
    inertiaMaxSpeed = 180, // deg/s
    inertiaDeceleration = 720; // deg/s^2

/**
 * The `DragRotateHandler` allows the user to rotate the map by clicking and
 * dragging the cursor while holding the right mouse button or `ctrl` key.
 */
class DragRotateHandler {
    _map: Map;
    _el: HTMLElement;
    _enabled: boolean;
    _active: boolean;
    _button: 'right' | 'left';
    _eventButton: number;
    _bearingSnap: number;
    _pitchWithRotate: boolean;

    _lastMoveEvent: MouseEvent;
    _pos: Point;
    _previousPos: Point;
    _inertia: Array<[number, number]>;
    _center: Point;

    /**
     * @param {Map} map The Mapbox GL JS map to add the handler to.
     * @param {Object} [options]
     * @param {number} [options.bearingSnap] The threshold, measured in degrees, that determines when the map's
     *   bearing will snap to north.
     * @param {bool} [options.pitchWithRotate=true] Control the map pitch in addition to the bearing
     * @private
     */
    constructor(map: Map, options: {
        button?: 'right' | 'left',
        element?: HTMLElement,
        bearingSnap?: number,
        pitchWithRotate?: boolean
    }) {
        this._map = map;
        this._el = options.element || map.getCanvasContainer();
        this._button = options.button || 'right';
        this._bearingSnap = options.bearingSnap || 0;
        this._pitchWithRotate = options.pitchWithRotate !== false;

        util.bindAll([
            '_onMove',
            '_onUp',
            '_onDragFrame'
        ], this);
    }

    /**
     * Returns a Boolean indicating whether the "drag to rotate" interaction is enabled.
     *
     * @returns {boolean} `true` if the "drag to rotate" interaction is enabled.
     */
    isEnabled() {
        return !!this._enabled;
    }

    /**
     * Returns a Boolean indicating whether the "drag to rotate" interaction is active, i.e. currently being used.
     *
     * @returns {boolean} `true` if the "drag to rotate" interaction is active.
     */
    isActive() {
        return !!this._active;
    }

    /**
     * Enables the "drag to rotate" interaction.
     *
     * @example
     * map.dragRotate.enable();
     */
    enable() {
        if (this.isEnabled()) return;
        this._enabled = true;
    }

    /**
     * Disables the "drag to rotate" interaction.
     *
     * @example
     * map.dragRotate.disable();
     */
    disable() {
        if (!this.isEnabled()) return;
        this._enabled = false;
    }

    onDown(e: MouseEvent) {
        if (!this.isEnabled()) return;
        if (this.isActive()) return;

        if (this._button === 'right') {
            this._eventButton = DOM.mouseButton(e);
            if (this._eventButton !== (e.ctrlKey ? 0 : 2)) return;
        } else {
            if (e.ctrlKey || DOM.mouseButton(e) !== 0) return;
            this._eventButton = 0;
        }

        DOM.disableDrag();

        // Bind window-level event listeners for move and up/end events. In the absence of
        // the pointer capture API, which is not supported by all necessary platforms,
        // window-level event listeners give us the best shot at capturing events that
        // fall outside the map canvas element. Use `{capture: true}` for the move event
        // to prevent map move events from being fired during a drag.
        window.document.addEventListener('mousemove', this._onMove, {capture: true});
        window.document.addEventListener('mouseup', this._onUp);

        // Deactivate when the window loses focus. Otherwise if a mouseup occurs when the window
        // isn't in focus, dragging will continue even though the mouse is no longer pressed.
        window.addEventListener('blur', this._onUp);

        this._active = false;
        this._inertia = [[browser.now(), this._map.getBearing()]];
        this._previousPos = DOM.mousePos(this._el, e);
        this._center = this._map.transform.centerPoint;  // Center of rotation

        e.preventDefault();
    }

    _onMove(e: MouseEvent) {
        this._lastMoveEvent = e;
        this._pos = DOM.mousePos(this._el, e);

        if (!this.isActive()) {
            this._active = true;
            this._fireEvent('rotatestart', e);
            this._fireEvent('movestart', e);
            if (this._pitchWithRotate) {
                this._fireEvent('pitchstart', e);
            }
        }

        this._map._startAnimation(this._onDragFrame);
    }

    _onDragFrame(tr: Transform) {
        const e = this._lastMoveEvent;
        if (!e) return;

        const p1 = this._previousPos,
            p2 = this._pos,
            bearingDiff = (p1.x - p2.x) * 0.8,
            pitchDiff = (p1.y - p2.y) * -0.5,
            bearing = tr.bearing - bearingDiff,
            pitch = tr.pitch - pitchDiff,
            inertia = this._inertia,
            last = inertia[inertia.length - 1];

        this._drainInertiaBuffer();
        inertia.push([browser.now(), this._map._normalizeBearing(bearing, last[1])]);

        tr.bearing = bearing;
        if (this._pitchWithRotate) {
            this._fireEvent('pitch', e);
            tr.pitch = pitch;
        }

        this._fireEvent('rotate', e);
        this._fireEvent('move', e);

        delete this._lastMoveEvent;
        this._previousPos = this._pos;
    }

    _onUp(e: MouseEvent | FocusEvent) {
        if (e.type === 'mouseup' && DOM.mouseButton((e: any)) !== this._eventButton) return;

        window.document.removeEventListener('mousemove', this._onMove, {capture: true});
        window.document.removeEventListener('mouseup', this._onUp);
        window.removeEventListener('blur', this._onUp);

        DOM.enableDrag();

        if (!this.isActive()) return;

        this._active = false;
        delete this._lastMoveEvent;
        delete this._previousPos;

        DOM.suppressClick();

        this._fireEvent('rotateend', e);
        this._drainInertiaBuffer();

        const map = this._map,
            mapBearing = map.getBearing(),
            inertia = this._inertia;

        const finish = () => {
            if (Math.abs(mapBearing) < this._bearingSnap) {
                map.resetNorth({noMoveStart: true}, { originalEvent: e });
            } else {
                this._fireEvent('moveend', e);
            }
            if (this._pitchWithRotate) this._fireEvent('pitchend', e);
        };

        if (inertia.length < 2) {
            finish();
            return;
        }

        const first = inertia[0],
            last = inertia[inertia.length - 1],
            previous = inertia[inertia.length - 2];
        let bearing = map._normalizeBearing(mapBearing, previous[1]);
        const flingDiff = last[1] - first[1],
            sign = flingDiff < 0 ? -1 : 1,
            flingDuration = (last[0] - first[0]) / 1000;

        if (flingDiff === 0 || flingDuration === 0) {
            finish();
            return;
        }

        let speed = Math.abs(flingDiff * (inertiaLinearity / flingDuration));  // deg/s
        if (speed > inertiaMaxSpeed) {
            speed = inertiaMaxSpeed;
        }

        const duration = speed / (inertiaDeceleration * inertiaLinearity),
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
    }

    _fireEvent(type: string, e: *) {
        return this._map.fire(new Event(type, e ? { originalEvent: e } : {}));
    }

    _drainInertiaBuffer() {
        const inertia = this._inertia,
            now = browser.now(),
            cutoff = 160;   //msec

        while (inertia.length > 0 && now - inertia[0][0] > cutoff)
            inertia.shift();
    }
}

module.exports = DragRotateHandler;
