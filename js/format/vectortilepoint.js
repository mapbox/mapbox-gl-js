'use strict';

module.exports = VectorTilePoint;
function VectorTilePoint(x, y) {
    this.x = x;
    this.y = y;
}

VectorTilePoint.prototype.toString = function() {
    return "Point(" + this.x + ", " + this.y + ")";
};
