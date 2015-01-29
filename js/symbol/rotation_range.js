'use strict';

var interpolate = require('../util/interpolate');
var Point = require('point-geometry');

module.exports = {
    rotationRange: rotationRange,
    mergeCollisions: mergeCollisions,

    rotatingFixedCollisions: rotatingFixedCollisions,
    rotatingRotatingCollisions: rotatingRotatingCollisions,

    cornerBoxCollisions: cornerBoxCollisions,
    circleEdgeCollisions: circleEdgeCollisions,

    getCorners: getCorners
};

/*
 * Calculate the range a box conflicts with a second box
 */
function rotationRange(inserting, blocker, scale) {

    var collisions, box;

    var a = inserting;
    var b = blocker;

    // Instead of scaling the boxes, we move the anchors
    var relativeAnchor = new Point(
        (b.anchor.x - a.anchor.x) * scale,
        (b.anchor.y - a.anchor.y) * scale);

    // Generate a list of collision interval
    if (a.hBox && b.hBox) {
        collisions = rotatingRotatingCollisions(a.box, b.box, relativeAnchor);

    } else if (a.hBox) {
        box = {
            x1: b.box.x1 + relativeAnchor.x,
            y1: b.box.y1 + relativeAnchor.y,
            x2: b.box.x2 + relativeAnchor.x,
            y2: b.box.y2 + relativeAnchor.y
        };
        collisions = rotatingFixedCollisions(a.box, box);


    } else if (b.hBox) {
        box = {
            x1: a.box.x1 - relativeAnchor.x,
            y1: a.box.y1 - relativeAnchor.y,
            x2: a.box.x2 - relativeAnchor.x,
            y2: a.box.y2 - relativeAnchor.y
        };
        collisions = rotatingFixedCollisions(b.box, box);

    } else {
        collisions = [];
    }

    // Find and return the continous are around 0 where there are no collisions
    return mergeCollisions(collisions, blocker.placementRange);
}

/*
 * Combine an array of collision ranges to form a continuous
 * range that includes 0. Collisions within the ignoreRange are ignored
 */
function mergeCollisions(collisions, ignoreRange) {

    // find continuous interval including 0 that doesn't have any collisions
    var min = 2 * Math.PI;
    var max = 0;

    for (var i = 0; i < collisions.length; i++) {
        var collision = collisions[i];

        var entryOutside = ignoreRange[0] <= collision[0] && collision[0] <= ignoreRange[1];
        var exitOutside = ignoreRange[0] <= collision[1] && collision[1] <= ignoreRange[1];

        if (entryOutside && exitOutside) {
            /*eslint no-empty: 0*/
            // no collision, since blocker is out of range
        } else if (entryOutside) {
            min = Math.min(min, ignoreRange[1]);
            max = Math.max(max, collision[1]);
        } else if (exitOutside) {
            min = Math.min(min, collision[0]);
            max = Math.max(max, ignoreRange[0]);
        } else {
            min = Math.min(min, collision[0]);
            max = Math.max(max, collision[1]);
        }
    }

    return [min, max];
}

/*
 *  Calculate collision ranges for two rotating boxes.
 */

var horizontal = new Point(1, 0);

function rotatingRotatingCollisions(a, b, anchorToAnchor) {
    var d = anchorToAnchor.mag();

    var angleBetweenAnchors = anchorToAnchor.angleWith(horizontal);

    var c = [],
        collisions = [],
        k;

    // Calculate angles at which collisions may occur
    // top/bottom
    c[0] = Math.asin((a.y2 - b.y1) / d);
    c[1] = Math.asin((a.y2 - b.y1) / d) + Math.PI;
    c[2] = 2 * Math.PI - Math.asin((-a.y1 + b.y2) / d);
    c[3] = Math.PI - Math.asin((-a.y1 + b.y2) / d);

    // left/right
    c[4] = 2 * Math.PI - Math.acos((a.x2 - b.x1) / d);
    c[5] = Math.acos((a.x2 - b.x1) / d);
    c[6] = Math.PI - Math.acos((-a.x1 + b.x2) / d);
    c[7] = Math.PI + Math.acos((-a.x1 + b.x2) / d);

    var rl = a.x2 - b.x1;
    var lr = -a.x1 + b.x2;
    var tb = a.y2 - b.y1;
    var bt = -a.y1 + b.y2;

    // Calculate the distance squared of the diagonal which will be used
    // to check if the boxes are close enough for collisions to occur at each angle
    // todo, triple check these
    var e = [];
    // top/bottom
    e[0] = rl * rl + tb * tb;
    e[1] = lr * lr + tb * tb;
    e[2] = rl * rl + bt * bt;
    e[3] = lr * lr + bt * bt;
    // left/right
    e[4] = rl * rl + tb * tb;
    e[5] = rl * rl + bt * bt;
    e[6] = lr * lr + bt * bt;
    e[7] = lr * lr + tb * tb;


    c = c.filter(function(x, i) {
        // Check if they are close enough to collide
        return !isNaN(x) && d * d <= e[i];
    }).map(function(x) {
        // So far, angles have been calulated as relative to the vector between anchors.
        // Convert the angles to angles from north.
        return (x + angleBetweenAnchors + 2 * Math.PI) % (2 * Math.PI);
    });

    // Group the collision angles by two
    // each group represents a range where the two boxes collide
    c.sort();
    for (k = 0; k < c.length; k += 2) {
        collisions.push([c[k], c[k + 1]]);
    }

    return collisions;

}

/*
 *  Calculate collision ranges for a rotating box and a fixed box;
 */
function rotatingFixedCollisions(rotating, fixed) {

    var cornersR = getCorners(rotating);
    var cornersF = getCorners(fixed);

    // A collision occurs when, and only at least one corner from one of the boxes
    // is within the other box. Calculate these ranges for each corner.

    var collisions = [];

    for (var i = 0; i < 4; i++) {
        cornerBoxCollisions(collisions, cornersR[i], cornersF);
        cornerBoxCollisions(collisions, cornersF[i], cornersR, true);
    }

    return collisions;
}


/*
 *  Calculate the ranges for which the corner,
 *  rotatated around the anchor, is within the box;
 */
function cornerBoxCollisions(collisions, corner, boxCorners, flip) {
    var radius = corner.mag(),
        angles = [];

    // Calculate the points at which the corners intersect with the edges
    for (var i = 0, j = 3; i < 4; j = i++) {
        circleEdgeCollisions(angles, corner, radius, boxCorners[j], boxCorners[i]);
    }

    if (angles.length % 2 !== 0) {
        // TODO fix
        // This could get hit when a point intersects very close to a corner
        // and floating point issues cause only one of the entry or exit to be counted
        throw new Error('expecting an even number of intersections');
    }

    angles.sort();

    // Group by pairs, where each represents a range where a collision occurs
    for (var k = 0; k < angles.length; k += 2) {
        collisions[k / 2] = flip ?
            [2 * Math.PI - angles[k + 1], 2 * Math.PI - angles[k]] : // reflect an angle around 0 degrees
            [angles[k], angles[k + 1]];
    }

    return collisions;
}

/*
 * Return the intersection points of a circle and a line segment;
 */
function circleEdgeCollisions(angles, corner, radius, p1, p2) {

    var edgeX = p2.x - p1.x;
    var edgeY = p2.y - p1.y;

    var a = edgeX * edgeX + edgeY * edgeY;
    var b = (edgeX * p1.x + edgeY * p1.y) * 2;
    var c = p1.x * p1.x + p1.y * p1.y - radius * radius;

    var discriminant = b * b - 4 * a * c;

    // a collision exists only if line intersects circle at two points
    if (discriminant > 0) {
        var x1 = (-b - Math.sqrt(discriminant)) / (2 * a);
        var x2 = (-b + Math.sqrt(discriminant)) / (2 * a);

        // only add points if within line segment
        // hack to handle floating point representations of 0 and 1
        if (x1 > 0 && x1 < 1) {
            angles.push(getAngle(p1, p2, x1, corner));
        }

        if (x2 > 0 && x2 < 1) {
            angles.push(getAngle(p1, p2, x2, corner));
        }
    }

    return angles;
}

function getAngle(p1, p2, d, corner) {
    return (-corner.angleWithSep(
            interpolate(p1.x, p2.x, d),
            interpolate(p1.y, p2.y, d)) + 2 * Math.PI) % (2 * Math.PI);
}

function getCorners(a) {
    return [
        new Point(a.x1, a.y1),
        new Point(a.x1, a.y2),
        new Point(a.x2, a.y2),
        new Point(a.x2, a.y1)
    ];
}
