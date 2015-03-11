'use strict';

var interpolate = require('../util/interpolate');
var Anchor = require('../symbol/anchor');
var checkMaxAngle = require('./check_max_angle');

module.exports = getAnchors;

function getAnchors(line, spacing, maxAngle, shapedText, glyphSize, boxScale, overscaling) {

    // Resample a line to get anchor points for labels and check that each
    // potential label passes text-max-angle check and has enough froom to fit
    // on the line.

    var angleWindowSize = shapedText ?
        3 / 5 * glyphSize * boxScale :
        0;

    // Offset the first anchor by half the label length (or half the spacing distance for icons).
    // Add a bit of extra offset to avoid collisions at T intersections.
    var labelLength = shapedText ? shapedText.right - shapedText.left : spacing;
    var extraOffset = glyphSize * 2;
    var offset = ((labelLength / 2 + extraOffset) * boxScale * overscaling) % spacing;

    return resample(line, offset, spacing, angleWindowSize, maxAngle, labelLength * boxScale, false);
}


function resample(line, offset, spacing, angleWindowSize, maxAngle, labelLength, placeAtMiddle) {

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
                var anchor = new Anchor(x, y, angle, 0.5, i);

                if (!angleWindowSize || checkMaxAngle(line, anchor, labelLength, angleWindowSize, maxAngle)) {
                    anchors.push(anchor);
                }
            }

            added++;
        }

        distance += segmentDist;
    }

    if (!placeAtMiddle && !anchors.length) {
        // The first attempt at finding anchors at which labels can be placed failed.
        // Try again, but this time just try placing one anchor at the middle of the line.
        // This has the most effect for short lines in overscaled tiles, since the
        // initial offset used in overscaled tiles is calculated to align labels with positions in
        // parent tiles instead of placing the label as close to the beginning as possible.
        anchors = resample(line, distance / 2, spacing, angleWindowSize, maxAngle, labelLength, true);
    }

    return anchors;
}
