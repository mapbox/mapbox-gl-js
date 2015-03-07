'use strict';

var interpolate = require('../util/interpolate');
var Anchor = require('../symbol/anchor');
var checkMaxAngle = require('../placement/check_max_angle');

module.exports = getAnchors;

function getAnchors(line, spacing, maxAngle, shapedText, glyphSize, boxScale, overscaling) {

    // Resample a line to get anchor points for labels and check that each
    // potential label passes text-max-angle check and has enough froom to fit
    // on the line.

    var angleWindowSize = 3 / 5 * glyphSize * boxScale;

    // Offset the first anchor by half the label length (or half the spacing distance for icons).
    // Add a bit of extra offset to avoid collisions at T intersections.
    var labelLength = shapedText ? shapedText.right - shapedText.left : spacing;
    var extraOffset = glyphSize * 2;
    var offset = ((labelLength / 2 + extraOffset) * boxScale * overscaling) % spacing;

    var distance = 0,
        markedDistance = offset ? offset - spacing : 0,
        added = 0;

    var anchors = [];

    for (var i = 0; i < line.length - 1; i++) {

        var a = line[i],
            b = line[i + 1];

        var segmentDist = a.dist(b),
            angle = b.angleTo(a);

        while (markedDistance + spacing < distance + segmentDist) {
            markedDistance += spacing;

            var t = (markedDistance - distance) / segmentDist,
                x = interpolate(a.x, b.x, t),
                y = interpolate(a.y, b.y, t);

            if (x >= 0 && x < 4096 && y >= 0 && y < 4096) {
                var anchor = new Anchor(x, y, angle, undefined, i);

                if (!shapedText || checkMaxAngle(line, anchor, labelLength * boxScale, angleWindowSize, maxAngle)) {
                    anchors.push(anchor);
                }
            }

            added++;
        }

        distance += segmentDist;
    }

    return anchors;
}
