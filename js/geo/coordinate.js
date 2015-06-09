'use strict';

module.exports = Coordinate;

/**
 * A coordinate is a column, row, zoom combination, often used
 * as the data component of a tile.
 *
 * @param {number} column
 * @param {number} row
 * @param {number} zoom
 * @private
 */
function Coordinate(column, row, zoom) {
    this.column = column;
    this.row = row;
    this.zoom = zoom;
}

Coordinate.prototype = {

    /**
     * Create a clone of this coordinate that can be mutated without
     * changing the original coordinate
     *
     * @returns {Coordinate} clone
     * @private
     * var coord = new Coordinate(0, 0, 0);
     * var c2 = coord.clone();
     * // since coord is cloned, modifying a property of c2 does
     * // not modify it.
     * c2.zoom = 2;
     */
    clone: function() {
        return new Coordinate(this.column, this.row, this.zoom);
    },

    /**
     * Zoom this coordinate to a given zoom level. This returns a new
     * coordinate object, not mutating the old one.
     *
     * @param {number} zoom
     * @returns {Coordinate} zoomed coordinate
     * @private
     * @example
     * var coord = new Coordinate(0, 0, 0);
     * var c2 = coord.zoomTo(1);
     * c2 // equals new Coordinate(0, 0, 1);
     */
    zoomTo: function(zoom) { return this.clone()._zoomTo(zoom); },

    /**
     * Subtract the column and row values of this coordinate from those
     * of another coordinate. The other coordinat will be zoomed to the
     * same level as `this` before the subtraction occurs
     *
     * @param {Coordinate} c other coordinate
     * @returns {Coordinate} result
     * @private
     */
    sub: function(c) { return this.clone()._sub(c); },

    _zoomTo: function(zoom) {
        var scale = Math.pow(2, zoom - this.zoom);
        this.column *= scale;
        this.row *= scale;
        this.zoom = zoom;
        return this;
    },

    _sub: function(c) {
        c = c.zoomTo(this.zoom);
        this.column -= c.column;
        this.row -= c.row;
        return this;
    }
};
