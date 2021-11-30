// @flow

import Point from '@mapbox/point-geometry';

import {register} from '../util/web_worker_transfer.js';

export default class Anchor extends Point {
    angle: number;
    z: number;
    segment: number | undefined;

    constructor(x: number, y: number, z: number, angle: number, segment?: number) {
        super(x, y);
        this.angle = angle;
        this.z = z;
        if (segment !== undefined) {
            this.segment = segment;
        }
    }

    clone(): Anchor {
        return new Anchor(this.x, this.y, this.z, this.angle, this.segment);
    }
}

register('Anchor', Anchor);
