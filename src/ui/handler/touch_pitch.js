// @flow

import Handler from './handler';
import type Map from '../map';
import DOM from '../../util/dom';
import Point from '@mapbox/point-geometry';
import {getTouchesById} from './handler_util';

export default class TouchPitchHandler extends Handler {

    constructor(map: Map, manager, options: ?Object) {
        super(map, options);
        this.firstTwoTouches = null;
    }

    touchstart(e, points) {
        if (this.firstTwoTouches || e.targetTouches.length < 2) return;

        this.firstTwoTouches = [
            e.targetTouches[0].identifier,
            e.targetTouches[1].identifier
        ];

        const [a, b] = getTouchesById(e, points, this.firstTwoTouches);
        const vector = a.sub(b);

        // fingers are more vertical than horizontal
        if (Math.abs(vector.y) > Math.abs(vector.x)) return;

        this.centerPoint = a.add(b).div(2);
    }

    touchmove(e, points) {

        if (!this.firstTwoTouches && this.aborted) return;

        const [a, b] = getTouchesById(e, points, this.firstTwoTouches)
        if (!a || !b) return;

        const centerPoint = a.add(b).div(2);
        const vector = centerPoint.sub(this.centerPoint);
        if (this.aborted === undefined) {
            if (Math.abs(vector.y) > Math.abs(vector.x)) {
                this.aborted = true;
                return;
            } else {
                this.aborted = false;
            }
        }

        const pitchDelta = vector.y * -0.5;

        this.centerPoint = centerPoint;

        return {
            transform: {
                pitchDelta
            }
        };
    }

    touchend(e, points) {
        if (!this.firstTwoTouches) return;

        const [a, b] = getTouchesById(e, points, this.firstTwoTouches);
        if (a && b) return;

        this.firstTwoTouches = null;
        this.aborted = undefined;

        return {
            events: ['dragend']
        }
    }
}
