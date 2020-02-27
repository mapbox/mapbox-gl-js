// @flow

import Handler from './handler';
import type Map from '../map';
import DOM from '../../util/dom';
import Point from '@mapbox/point-geometry';
import {log} from './handler_util';

import {TapRecognizer} from './tap_recognizer';

export default class TapZoomHandler extends Handler {

    constructor(map: Map, manager, options: ?Object) {
        this.manager = manager;
        super(map, options);

        this.zoomIn = new TapRecognizer({
            numTouches: 1,
            numTaps: 2
        });

        this.zoomOut = new TapRecognizer({
            numTouches: 2,
            numTaps: 1
        });

        this.reset();
    }

    reset() {
        this.active = false;
        this.zoomIn.reset();
        this.zoomOut.reset();
    }

    touchstart(e, points) {
        this.zoomIn.touchstart(e, points);
        this.zoomOut.touchstart(e, points);
    }

    touchmove(e, points) {
        this.zoomIn.touchmove(e, points);
        this.zoomOut.touchmove(e, points);
    }

    touchend(e, points) {
        const zoomInPoint = this.zoomIn.touchend(e, points);
        const zoomOutPoint = this.zoomOut.touchend(e, points);

        if (zoomInPoint) {
            return {
                transform: {
                    duration: 300,
                    zoomDelta: 1,
                    around: zoomInPoint
                }
            };
            setTimeout(() => this.reset(), 0);
        } else if (zoomOutPoint) {
            return {
                transform: {
                    duration: 300,
                    zoomDelta: -1,
                    around: zoomOutPoint
                }
            };
            setTimeout(() => this.reset(), 0);
        }
    }
}
