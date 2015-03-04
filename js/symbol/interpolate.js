'use strict';

var interp = require('../util/interpolate');
var Anchor = require('../symbol/anchor');

module.exports = interpolate;

var minScale = 0.5;
var minScaleArrays = {
    1: [minScale],
    2: [minScale, 2],
    4: [minScale, 4, 2, 4],
    8: [minScale, 8, 4, 8, 2, 8, 4, 8]
};

function interpolate(vertices, spacing, minScale, maxScale, tilePixelRatio, offset) {

    if (minScale === undefined) minScale = 0;

    maxScale = Math.round(Math.max(Math.min(8, maxScale / 2), 1));
    spacing *= tilePixelRatio / maxScale;
    offset *= tilePixelRatio;
    var minScales = minScaleArrays[maxScale];
    var len = minScales.length;

    var distance = 0,
        markedDistance = offset ? offset - spacing : 0,
        added = 0;

    var points = [];

    for (var i = 0; i < vertices.length - 1; i++) {

        var a = vertices[i],
            b = vertices[i + 1];

        var segmentDist = a.dist(b),
            angle = b.angleTo(a);

        while (markedDistance + spacing < distance + segmentDist) {
            markedDistance += spacing;

            var t = (markedDistance - distance) / segmentDist,
                x = interp(a.x, b.x, t),
                y = interp(a.y, b.y, t),
                s = minScales[added % len];

            if (x >= 0 && x < 4096 && y >= 0 && y < 4096) {
                points.push(new Anchor(x, y, angle, s, i));
            }

            added++;
        }

        distance += segmentDist;
    }

    return points;
}
