'use strict';

module.exports = Coordinate;

function Coordinate(column, row, zoom) {
    this.column = column;
    this.row = row;
    this.zoom = zoom;
}

Coordinate.prototype = {

    clone: function() {
        return new Coordinate(this.column, this.row, this.zoom);
    },

    zoomTo: function(zoom) { return this.clone()._zoomTo(zoom); },
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
