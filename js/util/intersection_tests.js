'use strict';

module.exports = {
    multiPolygonIntersectsBufferedMultiPoint: multiPolygonIntersectsBufferedMultiPoint,
    multiPolygonIntersectsMultiPolygon: multiPolygonIntersectsMultiPolygon,
    multiPolygonIntersectsBufferedMultiLine: multiPolygonIntersectsBufferedMultiLine
};

function multiPolygonIntersectsBufferedMultiPoint(multiPolygon, rings, radius) {
    for (var j = 0; j < multiPolygon.length; j++) {
        var polygon = multiPolygon[j];
        for (var i = 0; i < rings.length; i++) {
            var ring = rings[i];
            for (var k = 0; k < ring.length; k++) {
                var point = ring[k];
                if (polygonContainsPoint(polygon, point)) return true;
                if (pointIntersectsBufferedLine(point, polygon, radius)) return true;
            }
        }
    }
    return false;
}

function multiPolygonIntersectsMultiPolygon(multiPolygonA, multiPolygonB) {

    if (multiPolygonA.length === 1 && multiPolygonA[0].length === 1) {
        return multiPolygonContainsPoint(multiPolygonB, multiPolygonA[0][0]);
    }

    for (var m = 0; m < multiPolygonB.length; m++) {
        var ring = multiPolygonB[m];
        for (var n = 0; n < ring.length; n++) {
            if (multiPolygonContainsPoint(multiPolygonA, ring[n])) return true;
        }
    }

    for (var j = 0; j < multiPolygonA.length; j++) {
        var polygon = multiPolygonA[j];
        for (var i = 0; i < polygon.length; i++) {
            if (multiPolygonContainsPoint(multiPolygonB, polygon[i])) return true;
        }

        for (var k = 0; k < multiPolygonB.length; k++) {
            if (lineIntersectsLine(polygon, multiPolygonB[k])) return true;
        }
    }

    return false;
}

function multiPolygonIntersectsBufferedMultiLine(multiPolygon, multiLine, radius) {
    for (var i = 0; i < multiLine.length; i++) {
        var line = multiLine[i];

        for (var j = 0; j < multiPolygon.length; j++) {
            var polygon = multiPolygon[j];

            if (polygon.length >= 3) {
                for (var k = 0; k < line.length; k++) {
                    if (polygonContainsPoint(polygon, line[k])) return true;
                }
            }

            if (lineIntersectsBufferedLine(polygon, line, radius)) return true;
        }
    }
    return false;
}

function lineIntersectsBufferedLine(lineA, lineB, radius) {

    if (lineA.length > 1) {
        if (lineIntersectsLine(lineA, lineB)) return true;

        // Check whether any point in either line is within radius of the other line
        for (var j = 0; j < lineB.length; j++) {
            if (pointIntersectsBufferedLine(lineB[j], lineA, radius)) return true;
        }
    }

    for (var k = 0; k < lineA.length; k++) {
        if (pointIntersectsBufferedLine(lineA[k], lineB, radius)) return true;
    }

    return false;
}

function lineIntersectsLine(lineA, lineB) {
    for (var i = 0; i < lineA.length - 1; i++) {
        var a0 = lineA[i];
        var a1 = lineA[i + 1];
        for (var j = 0; j < lineB.length - 1; j++) {
            var b0 = lineB[j];
            var b1 = lineB[j + 1];
            if (lineSegmentIntersectsLineSegment(a0, a1, b0, b1)) return true;
        }
    }
    return false;
}


// http://bryceboe.com/2006/10/23/line-segment-intersection-algorithm/
function isCounterClockwise(a, b, c) {
    return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
}

function lineSegmentIntersectsLineSegment(a0, a1, b0, b1) {
    return isCounterClockwise(a0, b0, b1) !== isCounterClockwise(a1, b0, b1) &&
        isCounterClockwise(a0, a1, b0) !== isCounterClockwise(a0, a1, b1);
}

function pointIntersectsBufferedLine(p, line, radius) {
    var radiusSquared = radius * radius;

    if (line.length === 1) return p.distSqr(line[0]) < radiusSquared;

    for (var i = 1; i < line.length; i++) {
        // Find line segments that have a distance <= radius^2 to p
        // In that case, we treat the line as "containing point p".
        var v = line[i - 1], w = line[i];
        if (distToSegmentSquared(p, v, w) < radiusSquared) return true;
    }
    return false;
}

// Code from http://stackoverflow.com/a/1501725/331379.
function distToSegmentSquared(p, v, w) {
    var l2 = v.distSqr(w);
    if (l2 === 0) return p.distSqr(v);
    var t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    if (t < 0) return p.distSqr(v);
    if (t > 1) return p.distSqr(w);
    return p.distSqr(w.sub(v)._mult(t)._add(v));
}

// point in polygon ray casting algorithm
function multiPolygonContainsPoint(rings, p) {
    var c = false,
        ring, p1, p2;

    for (var k = 0; k < rings.length; k++) {
        ring = rings[k];
        for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            p1 = ring[i];
            p2 = ring[j];
            if (((p1.y > p.y) !== (p2.y > p.y)) && (p.x < (p2.x - p1.x) * (p.y - p1.y) / (p2.y - p1.y) + p1.x)) {
                c = !c;
            }
        }
    }
    return c;
}

function polygonContainsPoint(ring, p) {
    var c = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        var p1 = ring[i];
        var p2 = ring[j];
        if (((p1.y > p.y) !== (p2.y > p.y)) && (p.x < (p2.x - p1.x) * (p.y - p1.y) / (p2.y - p1.y) + p1.x)) {
            c = !c;
        }
    }
    return c;
}
