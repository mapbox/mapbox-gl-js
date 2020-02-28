// @flow

import DOM from '../../util/dom';
import Point from '@mapbox/point-geometry';
import {log, getTouchesById} from './handler_util';

function isVertical(vector) {
    return Math.abs(vector.y) > Math.abs(vector.x);
}

export default class TouchPitchHandler {

    _enabled: boolean;
    _active: boolean;
    _minTouches: number;
    _allowedSingleTouchTime: number;
    _firstTwoTouches: [number, number];
    _valid: true | false | typeof undefined;
    _firstSkip: number;
    a: Point;
    b: Point;

    constructor() {
        this.reset();
        this._minTouches = 2;
        this._allowedSingleTouchTime = 100;
    }

    reset() {
        this._active = false;
        delete this._firstTwoTouches;
        this._valid = undefined;
        delete this._firstSkip;
        delete this.a;
        delete this.b;
    }

    touchstart(e: TouchEvent, points: Array<Point>) {
        if (this._firstTwoTouches || e.targetTouches.length < this._minTouches) return;

        this._firstTwoTouches = [
            e.targetTouches[0].identifier,
            e.targetTouches[1].identifier
        ];

        const [a, b] = getTouchesById(e, points, this._firstTwoTouches);

        if (isVertical(a.sub(b))) {
            // fingers are more horizontal than vertical
            this._valid = false;
            return;
        }

        this.a = a;
        this.b = b;
    }

    gestureBeginsVertically(vectorA: Point, vectorB: Point, timeStamp: number) {
        if (this._valid !== undefined) return this._valid;

        if (vectorA.mag() === 0 || vectorB.mag() === 0) {

            if (this._firstSkip === null) {
                this._firstSkip = timeStamp;
            }

            if (timeStamp - this._firstSkip < this._allowedSingleTouchTime) {
                // still waiting for a movement from the second finger
                return undefined;
            } else {
                return false;
            }
        }

        const isSameDirection = vectorA.y > 0 === vectorB.y > 0;
        if (isVertical(vectorA) && isVertical(vectorB) && isSameDirection) {
            return true;
        } else {
            return false;
        }
    }

    touchmove(e: TouchEvent, points: Array<Point>) {

        if (!this._firstTwoTouches || this._valid === false) return;

        const [a, b] = getTouchesById(e, points, this._firstTwoTouches)
        if (!a || !b) return;

        const vectorA = a.sub(this.a);
        const vectorB = b.sub(this.b);

        this._valid = this.gestureBeginsVertically(vectorA, vectorB, e.timeStamp);
        if (!this._valid) return;

        const vector = vectorA.add(vectorB).div(2);
        const pitchDelta = vector.y * -0.5;

        this.a = a;
        this.b = b;

        this._active = true;

        return {
            transform: {
                pitchDelta
            }
        };
    }

    touchend(e: TouchEvent, points: Array<Point>) {
        if (!this._firstTwoTouches) return;

        const [a, b] = getTouchesById(e, points, this._firstTwoTouches);
        if (a && b && e.targetTouches.length >= this._minTouches) return;

        this.reset();
    }

    enable() {
        this._enabled = true;
    }

    disable() {
        this._enabled = false;
        this.reset();
    }

    isEnabled() {
        return this._enabled;
    }

    isActive() {
        return this._active;
    }
}
