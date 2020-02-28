// @flow

import DOM from '../../util/dom';
import Point from '@mapbox/point-geometry';
import {log, getTouchesById} from './handler_util';

function isVertical(vector) {
    return Math.abs(vector.y) > Math.abs(vector.x);
}

export default class TouchPitchHandler {

    constructor() {
        this.reset();
        this.minTouches = 2;
        this.allowedSingleTouchTime = 100;
    }

    reset() {
        this._active = false;
        this.firstTwoTouches = null;
        this.valid = undefined;
        this.firstSkip = null;
    }

    touchstart(e, points) {
        if (this.firstTwoTouches || e.targetTouches.length < this.minTouches) return;

        this.firstTwoTouches = [
            e.targetTouches[0].identifier,
            e.targetTouches[1].identifier
        ];

        const [a, b] = getTouchesById(e, points, this.firstTwoTouches);

        if (isVertical(a.sub(b))) {
            // fingers are more horizontal than vertical
            this.valid = false;
            return;
        }

        this.a = a;
        this.b = b;
    }

    gestureBeginsVertically(vectorA, vectorB, timeStamp) {
        if (this.valid !== undefined) return this.valid;

        if (vectorA.mag() === 0 || vectorB.mag() === 0) {

            if (this.firstSkip === null) {
                this.firstSkip = timeStamp;
            }

            if (timeStamp - this.firstSkip < this.allowedSingleTouchTime) {
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

    touchmove(e, points) {

        if (!this.firstTwoTouches || this.valid === false) return;

        const [a, b] = getTouchesById(e, points, this.firstTwoTouches)
        if (!a || !b) return;

        const vectorA = a.sub(this.a);
        const vectorB = b.sub(this.b);

        this.valid = this.gestureBeginsVertically(vectorA, vectorB, e.timeStamp);
        if (!this.valid) return;

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

    touchend(e, points) {
        if (!this.firstTwoTouches) return;

        const [a, b] = getTouchesById(e, points, this.firstTwoTouches);
        if (a && b && e.targetTouches.length >= this.minTouches) return;

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
