
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
export function fixedNum(n, precision) {
    if (precision === undefined) precision = 10;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return parseFloat(n.toFixed(precision), 10);
}

export function fixedLngLat(l, precision) {
    if (precision === undefined) precision = 9;
    return {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        lng: fixedNum(l.lng, precision),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        lat: fixedNum(l.lat, precision)
    };
}

export function fixedCoord(coord, precision) {
    if (precision === undefined) precision = 10;
    return {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        x: fixedNum(coord.x, precision),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        y: fixedNum(coord.y, precision),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        z: fixedNum(coord.z, precision)
    };
}

export function fixedPoint(point, precision) {
    if (precision === undefined) precision = 10;
    return {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        x: fixedNum(point.x, precision),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        y: fixedNum(point.y, precision)
    };
}

export function fixedVec3(vec, precision) {
    if (precision === undefined) precision = 10;
    return [
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        fixedNum(vec[0], precision),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        fixedNum(vec[1], precision),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        fixedNum(vec[2], precision)
    ];
}

export function fixedVec4(vec, precision) {
    if (precision === undefined) precision = 10;
    return [
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        fixedNum(vec[0], precision),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        fixedNum(vec[1], precision),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        fixedNum(vec[2], precision),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        fixedNum(vec[3], precision)
    ];
}
