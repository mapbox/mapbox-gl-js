
export function fixedNum(n, precision) {
    if (precision === undefined) precision = 10;
    return parseFloat(n.toFixed(precision), 10);
}

export function fixedLngLat(l, precision) {
    if (precision === undefined) precision = 9;
    return {
        lng: fixedNum(l.lng, precision),
        lat: fixedNum(l.lat, precision)
    };
}

export function fixedCoord(coord, precision) {
    if (precision === undefined) precision = 10;
    return {
        x: fixedNum(coord.x, precision),
        y: fixedNum(coord.y, precision),
        z: fixedNum(coord.z, precision)
    };
}

export function fixedPoint(point, precision) {
    if (precision === undefined) precision = 10;
    return {
        x: fixedNum(point.x, precision),
        y: fixedNum(point.y, precision)
    };
}

export function fixedVec3(vec, precision) {
    if (precision === undefined) precision = 10;
    return [
        fixedNum(vec[0], precision),
        fixedNum(vec[1], precision),
        fixedNum(vec[2], precision)
    ];
}

export function fixedVec4(vec, precision) {
    if (precision === undefined) precision = 10;
    return [
        fixedNum(vec[0], precision),
        fixedNum(vec[1], precision),
        fixedNum(vec[2], precision),
        fixedNum(vec[3], precision)
    ];
}
