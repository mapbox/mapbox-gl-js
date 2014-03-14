'use strict';

var Point = require('./point.js');

module.exports = Anchor;

function Anchor(x, y, angle, scale, segment) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.scale = scale;

    if (segment !== undefined) {
        this.segment = segment;
    }
}

Anchor.prototype = Object.create(Point);

Anchor.prototype.clone = function() {
    return new Anchor(this.x, this.y, this.angle, this.scale, this.segment);
};
