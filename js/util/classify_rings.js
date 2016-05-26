'use strict';

var quickselect = require('quickselect');

module.exports = classifyRings;

// classifies an array of rings into polygons with outer rings and holes

function classifyRings(rings, maxRings) {
    var len = rings.length;

    if (len <= 1) return [rings];

    var polygons = [],
        polygon,
        ccw;

    for (var i = 0; i < len; i++) {
        var area = signedArea(rings[i]);
        if (area === 0) continue;

        rings[i].area = Math.abs(area);

        if (ccw === undefined) ccw = area < 0;

        if (ccw === area < 0) {
            if (polygon) polygons.push(polygon);
            polygon = [rings[i]];

        } else {
            polygon.push(rings[i]);
        }
    }
    if (polygon) polygons.push(polygon);

    if (maxRings > 1) {
        len = polygons.length;
        for (var j = 0; j < len; j++) {
            if (polygons[j].length <= maxRings) continue;
            quickselect(polygons[j], maxRings - 1, 1, polygon.length - 1, sortByArea);
            polygons[j] = polygon.slice(0, maxRings);
        }
    }

    return polygons;
}

function sortByArea(a, b) {
    return b.area - a.area;
}

function signedArea(ring) {
    var sum = 0;
    for (var i = 0, len = ring.length, j = len - 1, p1, p2; i < len; j = i++) {
        p1 = ring[i];
        p2 = ring[j];
        sum += (p2.x - p1.x) * (p1.y + p2.y);
    }
    return sum;
}
