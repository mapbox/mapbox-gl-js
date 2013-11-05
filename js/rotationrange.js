var util = require('./util.js');

module.exports = {
    rotationRange: rotationRange,
    mergeCollisions: mergeCollisions,

    rotatingFixedCollisions: rotatingFixedCollisions,
    rotatingRotatingCollisions: rotatingRotatingCollisions,

    cornerBoxCollisions: cornerBoxCollisions,
    circleEdgeCollisions: circleEdgeCollisions,

    getCorners: getCorners,
};

/*
 * Calculate the range a box conflicts with a second box
 */
function rotationRange(inserting, blocker) {

    var collisions;

    var a = inserting;
    var b = blocker;

    // Generate a list of collision interval
    if (a.rotate && b.rotate) {
        collisions = rotatingRotatingCollisions(a, b);
    } else if (a.rotate) {
        collisions = rotatingFixedCollisions(a, b);
    } else if (b.rotate) {
        collisions = rotatingFixedCollisions(b, a);
    } else {
        collisions = [];
    }

    // Find and return the continous are around 0 where there are no collisions
    return mergeCollisions(collisions, blocker.range);
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
function rotatingRotatingCollisions(a, b) {
    var da = getDimensions(a);
    var db = getDimensions(b);
    var d = util.dist(a.anchor, b.anchor);

    var anchorToAnchor = util.vectorSub(b.anchor, a.anchor);
    var horizontal = { x: 1, y: 0};
    var angleBetweenAnchors = util.angleBetween(anchorToAnchor, horizontal);

    var c = [],
        collisions = [],
        k;

    // Calculate angles at which collisions may occur
    // top/bottom
    c[0] = 2 * Math.PI - Math.asin((da.ht + db.hb) / d);
    c[1] = Math.PI + Math.asin((da.ht + db.hb) / d);
    c[2] = Math.asin((da.hb + db.ht) / d);
    c[3] = Math.PI - Math.asin((da.hb + db.ht) / d);

    // left/right
    c[4] = 2 * Math.PI - Math.acos((da.wr + db.wl) / d);
    c[5] = Math.acos((da.wr + db.wl) / d);
    c[6] = Math.PI - Math.acos((da.wl + db.wr) / d);
    c[7] = Math.PI + Math.acos((da.wl + db.wr) / d);

    var rl = da.wr + db.wl;
    var lr = da.wl + db.wr;
    var tb = da.ht + db.hb;
    var bt = da.hb + db.ht;

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
    for (k = 0; k < c.length; k+=2) {
        collisions.push([c[k], c[k+1]]);
    }

    return collisions;
    
}

// Reflect an angle around 0 degrees
function flip(c) {
    return [2 * Math.PI - c[1], 2 * Math.PI - c[0]];
}

/*
 *  Calculate collision ranges for a rotating box and a fixed box;
 */
function rotatingFixedCollisions(rotating, fixed) {
    var anchor = rotating.anchor;

    var cornersR = getCorners(rotating.box);
    var cornersF = getCorners(fixed.box);

    // A collision occurs when, and only at least one corner from one of the boxes
    // is within the other box. Calculate these ranges for each corner.

    var collisions = [];

    for (var i = 0; i < 4; i++ ) {
        collisions = collisions.concat(cornerBoxCollisions(anchor, cornersR[i], cornersF));
        collisions = collisions.concat(cornerBoxCollisions(anchor, cornersF[i], cornersR).map(flip));
    }

    return collisions;
}


/*
 *  Calculate the ranges for which the corner,
 *  rotatated around the anchor, is within the box;
 */
function cornerBoxCollisions(anchor, corner, boxCorners) {
    var radius = util.dist(anchor, corner);
    var collisionPoints = [];

    // Calculate the points at which the corners intersect with the edges
    for (var i = 0, j = 3; i < 4; j = i++) {
        var points = circleEdgeCollisions(anchor, radius, boxCorners[j], boxCorners[i]);
        collisionPoints = collisionPoints.concat(points);
    }

    if (collisionPoints.length % 2 !== 0) {
        // TODO fix
        // This could get hit when a point intersects very close to a corner
        // and floating point issues cause only one of the entry or exit to be counted
        throw('expecting an even number of intersections');
    }

    var anchorToCorner = util.vectorSub(corner, anchor);

    // Convert points to angles
    var angles = collisionPoints.map(function(point) {
        var anchorToPoint = util.vectorSub(point, anchor);
        var angle = util.angleBetween(anchorToPoint, anchorToCorner);
        return (angle + 2 * Math.PI) % (2 * Math.PI);
    }).sort();

    var collisions = [];

    // Group by pairs, where each represents a range where a collision occurs
    for (var k = 0; k < angles.length; k+=2) {
        collisions[k/2] = [angles[k], angles[k+1]];
    }

    return collisions;
}

/*
 * Return the intersection points of a circle and a line segment;
 */
function circleEdgeCollisions(center, radius, p1, p2) {

    var centerToP1 = util.vectorSub(p1, center);
    var edge = util.vectorSub(p2, p1);

    var a = util.dot(edge, edge);
    var b = util.dot(edge, centerToP1) * 2;
    var c = util.dot(centerToP1, centerToP1) - radius * radius;

    var discriminant = b*b - 4*a*c;

    var points = [];

    // a collision exists only if line intersects circle at two points
    if (discriminant > 0) {
        var x1 = (-b - Math.sqrt(discriminant)) / (2 * a);
        var x2 = (-b + Math.sqrt(discriminant)) / (2 * a);

        // only add points if within line segment
        // hack to handle floating point representations of 0 and 1
        if (0 < x1 && x1 < 1) {
            points.push(point(x1));
        }

        if (0 < x2 && x2 < 1) {
            points.push(point(x2));
        }
    }

    // convert distance along segment to point
    function point(d) {
        return {
            x: util.interp(p1.x, p2.x, d),
            y: util.interp(p1.y, p2.y, d)
        };
    }

    return points;
}


function getCorners(a) {
    return [
        { x: a.x1, y: a.y1 },
        { x: a.x1, y: a.y2 },
        { x: a.x2, y: a.y2 },
        { x: a.x2, y: a.y1 }
    ];
}

function getDimensions(a) {
    return {
            ht: a.anchor.y - a.box.y1,
            hb: a.box.y2 - a.anchor.y,
            wl: a.anchor.x - a.box.x1,
            wr: a.box.x2 - a.anchor.x
    };
}

