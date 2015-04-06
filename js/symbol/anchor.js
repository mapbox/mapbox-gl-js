'use strict';

var Point = require('point-geometry');

module.exports = Anchor;

function Anchor(x, y, angle, segment) {
    this.x = x;
    this.y = y;
    this.angle = angle;

    if (segment !== undefined) {
        this.segment = segment;
    }
}

Anchor.prototype = Object.create(Point.prototype);

Anchor.prototype.clone = function() {
    return new Anchor(this.x, this.y, this.angle, this.segment);
};
