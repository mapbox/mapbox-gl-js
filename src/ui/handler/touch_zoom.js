// @flow

import Handler from './handler';
import type Map from '../map';
import DOM from '../../util/dom';
import Point from '@mapbox/point-geometry';
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
        this.distance = a.dist(b);

        return {
            events: ['dragstart']
        }
    }

    touchmove(e, points) {

        if (!this.firstTwoTouches) return;

        const [a, b] = getTouchesById(e, points, this.firstTwoTouches)
        if (!a || !b) return;

        const distance = a.dist(b);
        const zoomDelta = Math.log(distance / this.distance) / Math.LN2;
        const around = a.add(b).div(2);

        this.distance = distance;

        return {
            transform: {
                around,
                zoomDelta
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
