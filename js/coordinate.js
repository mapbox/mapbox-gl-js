var Coordinate = {};

Coordinate.zoomTo = function(c, z) {
    return {
        column: c.column * Math.pow(2, z - c.zoom),
        row: c.row * Math.pow(2, z - c.zoom),
        zoom: z
    };
};
