'use strict';

module.exports = {
    Num: fixedNum,
    LngLat: fixedLngLat,
    Coord: fixedCoord
};

function fixedNum(n, precision) {
    if (precision === undefined) precision = 10;
    return parseFloat(n.toFixed(precision), 10);
}

function fixedLngLat(l, precision) {
    if (precision === undefined) precision = 10;
    return {
        lng: fixedNum(l.lng, precision),
        lat: fixedNum(l.lat, precision)
    };
}

function fixedCoord(coord, precision) {
    if (precision === undefined) precision = 10;
    return {
        column: fixedNum(coord.column, precision),
        row: fixedNum(coord.row, precision),
        zoom: coord.zoom
    };
}
