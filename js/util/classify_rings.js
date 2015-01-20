'use strict';

module.exports = classifyRings;

// classifies an array of rings into polygons with outer rings and holes

function classifyRings(rings) {
    var len = rings.length;

    if (len <= 1) return [rings];

    var i, j,
        config = new Array(len);

    for (i = 0; i < len; i++) {
        if (config[i]) continue;
        config[i] = false;
        for (j = 0; j < len; j++) {
            if (i === j || config[j]) continue;

            if (ringPartiallyContains(rings[i], rings[j])) {

                 // mark i as outer ring; add j as inner ring
                config[i] = config[i] || [rings[i]];
                config[i].push(rings[j]);
                config[j] = true; // mark j as inner ring
            }
        }
    }

    var polygons = [];
    for (i = 0; i < len; i++) {
        if (config[i] === false) polygons.push([rings[i]]);
        else if (config[i].length) polygons.push(config[i]);
    }

    return polygons;
}

function ringPartiallyContains(outer, inner) {
    var threshold = Math.min(Math.ceil(inner.length * 0.01), 10),
        num = 0;
    for (var i = 0; i < threshold * 2; i++) {
        if (ringContains(outer, inner[i])) num++;
    }
    if (num >= threshold) return true;
}

function ringContains(points, p) {
    var len = points.length,
        inside = false,
        i, j, p1, p2;

    for (i = 0, j = len - 1; i < len; j = i++) {
        p1 = points[i];
        p2 = points[j];
        if (((p1[1] > p[1]) !== (p2[1] > p[1])) &&
                (p[0] < (p2[0] - p1[0]) * (p[1] - p1[1]) / (p2[1] - p1[1]) + p1[0])) inside = !inside;
    }
    return inside;
}
