'use strict';

exports.zoomTo = function(c, z) {
    var c2 = {
        column: c.column,
        row: c.row,
        zoom: c.zoom
    };
    return exports.izoomTo(c2, z);
};

exports.izoomTo = function(c, z) {
    c.column = c.column * Math.pow(2, z - c.zoom);
    c.row = c.row * Math.pow(2, z - c.zoom);
    c.zoom = z;
    return c;
};

exports.ifloor = function(c) {
    c.column = Math.floor(c.column);
    c.row = Math.floor(c.row);
    c.zoom = Math.floor(c.zoom);
    return c;
};
