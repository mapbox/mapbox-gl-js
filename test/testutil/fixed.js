'use strict';

module.exports = {
    LngLat: fixedLngLat,
    Coord: fixedCoord
};

function fixedLngLat(l, precision) {
    if (precision === undefined) precision = 10;
    return {
        lng: parseFloat(l.lng.toFixed(precision), 10),
        lat: parseFloat(l.lat.toFixed(precision), 10)
    };
}

function fixedCoord(coord, precision) {
    if (precision === undefined) precision = 10;
    return {
        column: parseFloat(coord.column.toFixed(precision), 10),
        row: parseFloat(coord.row.toFixed(precision), 10),
        zoom: coord.zoom
    };
}
