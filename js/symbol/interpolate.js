'use strict';

var interp = require('../util/interpolate');
var Anchor = require('../symbol/anchor');

module.exports = interpolate;

function interpolate(vertices, spacing, offset) {

    offset = offset % spacing;

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
                y = interp(a.y, b.y, t);

            if (x >= 0 && x < 4096 && y >= 0 && y < 4096) {
                points.push(new Anchor(x, y, angle, undefined, i));
            }

            added++;
        }

        distance += segmentDist;
    }

    return points;
}
