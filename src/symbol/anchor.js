// @flow

import Point from '@mapbox/point-geometry';

import {register} from '../util/web_worker_transfer.js';

class Anchor extends Point {
    angle: any;
    z: any;
    segment: number | void;
    inside: boolean;

    constructor(x: number, y: number, z: number, angle: number, segment?: number, inside?: boolean) {
        super(x, y);
        this.angle = angle;
        this.z = z;
        this.inside = inside !== undefined ? inside : true;
        if (segment !== undefined) {
            this.segment = segment;
        }
    }

    clone() {
        return new Anchor(this.x, this.y, this.z, this.angle, this.segment, this.inside);
    }
}

register('Anchor', Anchor);

export default Anchor;
