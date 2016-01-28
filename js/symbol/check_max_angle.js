'use strict';

module.exports = checkMaxAngle;

/**
 * Labels placed around really sharp angles aren't readable. Check if any
 * part of the potential label has a combined angle that is too big.
 *
 * @param {Array<Point>} line
 * @param {Anchor} anchor The point on the line around which the label is anchored.
 * @param {number} labelLength The length of the label in geometry units.
 * @param {number} windowSize The check fails if the combined angles within a part of the line that is `windowSize` long is too big.
 * @param {number} maxAngle The maximum combined angle that any window along the label is allowed to have.
 *
 * @returns {boolean} whether the label should be placed
 * @private
 */
function checkMaxAngle(line, anchor, labelLength, windowSize, maxAngle) {

    // horizontal labels always pass
    if (anchor.segment === undefined) return true;

    var p = anchor;
    var index = anchor.segment + 1;
    var anchorDistance = 0;

    // move backwards along the line to the first segment the label appears on
    while (anchorDistance > -labelLength / 2) {
        index--;

        // there isn't enough room for the label after the beginning of the line
        if (index < 0) return false;

        anchorDistance -= line[index].dist(p);
        p = line[index];
    }

    anchorDistance += line[index].dist(line[index + 1]);
    index++;

    // store recent corners and their total angle difference
    var recentCorners = [];
    var recentAngleDelta = 0;

    // move forwards by the length of the label and check angles along the way
    while (anchorDistance < labelLength / 2) {
        var prev = line[index - 1];
        var current = line[index];
        var next = line[index + 1];

        // there isn't enough room for the label before the end of the line
        if (!next) return false;

        var angleDelta = prev.angleTo(current) - current.angleTo(next);
        // restrict angle to -pi..pi range
        angleDelta = Math.abs(((angleDelta + 3 * Math.PI) % (Math.PI * 2)) - Math.PI);

        recentCorners.push({
            distance: anchorDistance,
            angleDelta: angleDelta
        });
        recentAngleDelta += angleDelta;

        // remove corners that are far enough away from the list of recent anchors
        while (anchorDistance - recentCorners[0].distance > windowSize) {
            recentAngleDelta -= recentCorners.shift().angleDelta;
        }

        // the sum of angles within the window area exceeds the maximum allowed value. check fails.
        if (recentAngleDelta > maxAngle) return false;

        index++;
        anchorDistance += current.dist(next);
    }

    // no part of the line had an angle greater than the maximum allowed. check passes.
    return true;
}
