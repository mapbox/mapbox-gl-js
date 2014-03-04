'use strict';

var util = require('../util/util.js');

module.exports = interpolate;

function interpolate(vertices, spacing, minScale, start) {

    if (minScale === undefined) minScale = 0;

    var distance = 0,
        markedDistance = 0,
        added = start || 0;

    var points = [];

    for (var i = 0; i < vertices.length - 1; i++) {

        var a = vertices[i],
            b = vertices[i + 1];

        var segmentDist = util.dist(a, b),
            slope = util.normal(a, b),
            angle = Math.atan2(slope.y, slope.x);

        while (markedDistance + spacing < distance + segmentDist) {
            markedDistance += spacing;

            var t = (markedDistance - distance) / segmentDist,
                x = util.interp(a.x, b.x, t),
                y = util.interp(a.y, b.y, t),
                s = added % 8 === 0 ? minScale :
                    added % 4 === 0 ? 2 :
                    added % 2 === 0 ? 4 :
                    8;

            if (x >= 0 && x < 4096 && y >= 0 && y < 4096) {
                points.push({
                    x: x,
                    y: y,
                    segment: i,
                    angle: angle,
                    scale: s
                });
            }

            added++;
        }

        distance += segmentDist;
    }

    return points;
}
