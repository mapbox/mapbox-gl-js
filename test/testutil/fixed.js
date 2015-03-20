'use strict';

module.exports = {
    LatLng: fixedLatLng,
    Coord: fixedCoord
};

function fixedLatLng(l, precision) {
    if (precision === undefined) precision = 10;
    return {
        lat: parseFloat(l.lat.toFixed(precision), 10),
        lng: parseFloat(l.lng.toFixed(precision), 10)
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
