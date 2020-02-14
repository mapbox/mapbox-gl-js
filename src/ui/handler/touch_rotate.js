// @flow

import Handler from './handler';
import type Map from '../map';
import Point from '@mapbox/point-geometry';
import assert from 'assert';
import {getTouchesById} from './handler_util';

export default class TouchZoomHandler extends Handler {

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
        this.vector = a.sub(b);

        return {
            events: ['dragstart']
        }
    }

    touchmove(e, points) {
        if (!this.firstTwoTouches) return;

        const [a, b] = getTouchesById(e, points, this.firstTwoTouches);
        const vector = a.sub(b);
        const bearingDelta = vector.angleWith(this.vector) * 180 / Math.PI;
        const around = a.add(b).div(2);

        this.vector = vector;

        return {
            transform: {
                around,
                bearingDelta
            }
        };
    }

    touchend(e, points) {
        if (!this.firstTwoTouches) return;

        const [a, b] = getTouchesById(e, points, this.firstTwoTouches);
        if (a && b) return;

        this.firstTwoTouches = null;

        return {
            events: ['dragend']
        }
    }
}
