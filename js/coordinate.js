var Coordinate = {};

Coordinate.zoomTo = function(c, z) {
    return {
        column: c.column * Math.pow(2, z - c.zoom),
        row: c.row * Math.pow(2, z - c.zoom),
        zoom: z
    };
};

Coordinate.izoomTo = function(c, z) {
    c.column = c.column * Math.pow(2, z - c.zoom);
    c.row = c.row * Math.pow(2, z - c.zoom);
    c.zoom = z;
};
