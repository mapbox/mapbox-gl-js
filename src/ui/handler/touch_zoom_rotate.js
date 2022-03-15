// @flow

import Point from '@mapbox/point-geometry';
import * as DOM from '../../util/dom.js';
import type Map from '../map.js';
import type {HandlerResult} from '../handler_manager.js';

class TwoTouchHandler {

    _enabled: boolean;
    _active: boolean;
    _firstTwoTouches: ?[number, number];
    _vector: ?Point;
    _startVector: ?Point;
    _aroundCenter: boolean;

    constructor() {
        this.reset();
    }

    reset() {
        this._active = false;
        this._firstTwoTouches = undefined;
    }

    _start(points: [Point, Point]) {} //eslint-disable-line
    _move(points: [Point, Point], pinchAround: Point, e: TouchEvent): ?HandlerResult { return {}; } //eslint-disable-line

    touchstart(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) {
        //console.log(e.target, e.targetTouches.length ? e.targetTouches[0].target : null);
        //log('touchstart', points, e.target.innerHTML, e.targetTouches.length ? e.targetTouches[0].target.innerHTML: undefined);
        if (this._firstTwoTouches || mapTouches.length < 2) return;

        this._firstTwoTouches = [
            mapTouches[0].identifier,
            mapTouches[1].identifier
        ];

        // implemented by child classes
        this._start([points[0], points[1]]);
    }

    touchmove(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>): ?HandlerResult {
        const firstTouches = this._firstTwoTouches;
        if (!firstTouches) return;

        e.preventDefault();

        const [idA, idB] = firstTouches;
        const a = getTouchById(mapTouches, points, idA);
        const b = getTouchById(mapTouches, points, idB);
        if (!a || !b) return;
        const pinchAround = this._aroundCenter ? null : a.add(b).div(2);

        // implemented by child classes
        return this._move([a, b], pinchAround, e);

    }

    touchend(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) {
        if (!this._firstTwoTouches) return;

        const [idA, idB] = this._firstTwoTouches;
        const a = getTouchById(mapTouches, points, idA);
        const b = getTouchById(mapTouches, points, idB);
        if (a && b) return;

        if (this._active) DOM.suppressClick();

        this.reset();
    }

    touchcancel() {
        this.reset();
    }

    enable(options: ?{around?: 'center'}) {
        this._enabled = true;
        this._aroundCenter = !!options && options.around === 'center';
    }

    disable() {
        this._enabled = false;
        this.reset();
    }

    isEnabled(): boolean {
        return this._enabled;
    }

    isActive(): boolean {
        return this._active;
    }
}

function getTouchById(mapTouches: Array<Touch>, points: Array<Point>, identifier: number) {
    for (let i = 0; i < mapTouches.length; i++) {
        if (mapTouches[i].identifier === identifier) return points[i];
    }
}

/* ZOOM */

const ZOOM_THRESHOLD = 0.1;

function getZoomDelta(distance, lastDistance) {
    return Math.log(distance / lastDistance) / Math.LN2;
}

export class TouchZoomHandler extends TwoTouchHandler {

    _distance: number;
    _startDistance: number;

    reset() {
        super.reset();
        this._distance = 0;
        this._startDistance = 0;
    }

    _start(points: [Point, Point]) {
        this._startDistance = this._distance = points[0].dist(points[1]);
    }

    _move(points: [Point, Point], pinchAround: Point): ?HandlerResult {
        const lastDistance = this._distance;
        this._distance = points[0].dist(points[1]);
        if (!this._active && Math.abs(getZoomDelta(this._distance, this._startDistance)) < ZOOM_THRESHOLD) return;
        this._active = true;
        return {
            zoomDelta: getZoomDelta(this._distance, lastDistance),
            pinchAround
        };
    }
}

/* ROTATE */

const ROTATION_THRESHOLD = 25; // pixels along circumference of touch circle

function getBearingDelta(a, b) {
    return a.angleWith(b) * 180 / Math.PI;
}

export class TouchRotateHandler extends TwoTouchHandler {
    _minDiameter: number;

    reset() {
        super.reset();
        this._minDiameter = 0;
        this._startVector = undefined;
        this._vector = undefined;
    }

    _start(points: [Point, Point]) {
        this._startVector = this._vector = points[0].sub(points[1]);
        this._minDiameter = points[0].dist(points[1]);
    }

    _move(points: [Point, Point], pinchAround: Point): ?HandlerResult {
        const lastVector = this._vector;
        this._vector = points[0].sub(points[1]);

        if (!this._active && this._isBelowThreshold(this._vector)) return;
        this._active = true;

        return {
            bearingDelta: getBearingDelta(this._vector, lastVector),
            pinchAround
        };
    }

    _isBelowThreshold(vector: Point): boolean {
        /*
         * The threshold before a rotation actually happens is configured in
         * pixels alongth circumference of the circle formed by the two fingers.
         * This makes the threshold in degrees larger when the fingers are close
         * together and smaller when the fingers are far apart.
         *
         * Use the smallest diameter from the whole gesture to reduce sensitivity
         * when pinching in and out.
         */

        this._minDiameter = Math.min(this._minDiameter, vector.mag());
        const circumference = Math.PI * this._minDiameter;
        const threshold = ROTATION_THRESHOLD / circumference * 360;

        const bearingDeltaSinceStart = getBearingDelta(vector, this._startVector);
        return Math.abs(bearingDeltaSinceStart) < threshold;
    }
}

/* PITCH */

function isVertical(vector) {
    return Math.abs(vector.y) > Math.abs(vector.x);
}

const ALLOWED_SINGLE_TOUCH_TIME = 100;

/**
 * The `TouchPitchHandler` allows the user to pitch the map by dragging up and down with two fingers.
 *
 * @see [Example: Set pitch and bearing](https://docs.mapbox.com/mapbox-gl-js/example/set-perspective/)
*/
export class TouchPitchHandler extends TwoTouchHandler {

    _valid: boolean | void;
    _firstMove: ?number;
    _lastPoints: ?[Point, Point];
    _map: Map;

    constructor(map: Map) {
        super();
        this._map = map;
    }

    reset() {
        super.reset();
        this._valid = undefined;
        this._firstMove = undefined;
        this._lastPoints = undefined;
    }

    _start(points: [Point, Point]) {
        this._lastPoints = points;
        if (isVertical(points[0].sub(points[1]))) {
            // fingers are more horizontal than vertical
            this._valid = false;
        }

    }

    _move(points: [Point, Point], center: Point, e: TouchEvent): ?HandlerResult {
        const lastPoints = this._lastPoints;
        if (!lastPoints) return;
        const vectorA = points[0].sub(lastPoints[0]);
        const vectorB = points[1].sub(lastPoints[1]);

        if (this._map._cooperativeGestures && e.touches.length < 3) return;

        this._valid = this.gestureBeginsVertically(vectorA, vectorB, e.timeStamp);

        if (!this._valid) return;

        this._lastPoints = points;
        this._active = true;
        const yDeltaAverage = (vectorA.y + vectorB.y) / 2;
        const degreesPerPixelMoved = -0.5;
        return {
            pitchDelta: yDeltaAverage * degreesPerPixelMoved
        };
    }

    gestureBeginsVertically(vectorA: Point, vectorB: Point, timeStamp: number): void | boolean {
        if (this._valid !== undefined) return this._valid;

        const threshold = 2;
        const movedA = vectorA.mag() >= threshold;
        const movedB = vectorB.mag() >= threshold;

        // neither finger has moved a meaningful amount, wait
        if (!movedA && !movedB) return;

        // One finger has moved and the other has not.
        // If enough time has passed, decide it is not a pitch.
        if (!movedA || !movedB) {
            if (this._firstMove == null) {
                this._firstMove = timeStamp;
            }

            if (timeStamp - this._firstMove < ALLOWED_SINGLE_TOUCH_TIME) {
                // still waiting for a movement from the second finger
                return undefined;
            } else {
                return false;
            }
        }

        const isSameDirection = vectorA.y > 0 === vectorB.y > 0;
        return isVertical(vectorA) && isVertical(vectorB) && isSameDirection;
    }
}
