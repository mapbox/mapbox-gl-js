'use strict';

const Point = require('point-geometry');

class Anchor extends Point {

    constructor(x, y, angle, segment) {
        super(x, y);
        this.angle = angle;
        if (segment !== undefined) {
            this.segment = segment;
        }
    }

    clone() {
        return new Anchor(this.x, this.y, this.angle, this.segment);
    }
}

module.exports = Anchor;
