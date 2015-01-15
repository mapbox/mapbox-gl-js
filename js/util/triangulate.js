'use strict';

module.exports = earcut;

function earcut(points) {

    var sum = 0,
        len = points.length,
        i, j, last;

    // create a doubly linked list from polygon points, detecting winding order along the way
    for (i = 0, j = len - 1; i < len; j = i++) {
        last = insertNode(points[i], last);
        sum += (points[i][0] - points[j][0]) * (points[i][1] + points[j][1]);
    }

    last = filterPoints(last);

    var triangles = [],
        ccw = sum < 0;

    earcutLinked(last, ccw, triangles);

    return triangles;
}

function filterPoints(start) {
    // eliminate colinear or duplicate points
    var node = start;
    do {
        var next = node.next;
        if (equals(node.p, next.p) || orient(node.p, next.p, next.next.p) === 0) {
            node.next = next.next;
            next.next.prev = node;
            if (next === start) return next.next;
            continue;
        }
        node = next;
    } while (node !== start);

    return start;
}

function equals(p1, p2) {
    return p1[0] === p2[0] && p1[1] === p2[1];
}

function earcutLinked(ear, ccw, triangles) {
    var stop = ear,
        prev, next;

    // iterate through ears, slicing them one by one
    while (ear.prev !== ear.next) {
        prev = ear.prev;
        next = ear.next;

        if (isEar(ear, ccw)) {
            triangles.push(prev.p, ear.p, next.p);
            next.prev = prev;
            prev.next = next;
            stop = next.next;
        }
        ear = next.next;

        if (ear.next.next === stop) {
            // if we can't find valid ears anymore, split remaining polygon into two
            splitEarcut(ear, ccw, triangles);
            break;
        }
    }
}

// iterate through points to check if there's a reflex point inside a potential ear
function isEar(ear, ccw) {

    var a = ear.prev.p,
        b = ear.p,
        c = ear.next.p,

        ax = a[0], bx = b[0], cx = c[0],
        ay = a[1], by = b[1], cy = c[1],

        abd = ax * by - ay * bx,
        acd = ax * cy - ay * cx,
        cbd = cx * by - cy * bx,
        A = abd - acd - cbd;

    if (ccw !== (A > 0)) return false; // reflex

    var sign = ccw ? 1 : -1,
        node = ear.next.next,
        cay = cy - ay,
        acx = ax - cx,
        aby = ay - by,
        bax = bx - ax,
        p, px, py, s, t;

    while (node !== ear.prev) {

        p = node.p;
        px = p[0];
        py = p[1];

        s = (cay * px + acx * py - acd) * sign;
        t = (aby * px + bax * py + abd) * sign;

        if (s >= 0 && t >= 0 && (s + t) <= A * sign) return false;

        node = node.next;
    }
    return true;
}

function insertNode(point, last) {
    var node = {
        p: point,
        prev: null,
        next: null
    };

    if (!last) {
        node.prev = node;
        node.next = node;

    } else {
        node.next = last.next;
        node.prev = last;
        last.next.prev = node;
        last.next = node;
    }
    return node;
}

function splitEarcut(start, ccw, triangles) {

    // find a valid diagonal that divides the polygon into two
    var a = start;
    do {
        var b = a.next.next;
        while (b !== a.prev) {
            if (!intersectsPolygon(start, a.p, b.p) && locallyInside(a, b, ccw) && locallyInside(b, a, ccw) &&
                    middleInside(start, a.p, b.p)) {
                splitEarcutByDiag(a, b, ccw, triangles);
                return;
            }
            b = b.next;
        }
        a = a.next;
    } while (a !== start);
}

function splitEarcutByDiag(a, b, ccw, triangles) {
    var a2 = {p: a.p, prev: null, next: null},
        b2 = {p: b.p, prev: null, next: null},
        an = a.next,
        bp = b.prev;

    // split the polygon vertices circular doubly-linked linked list into two
    a.next = b;
    b.prev = a;

    a2.next = an;
    an.prev = a2;

    b2.next = a2;
    a2.prev = b2;

    bp.next = b2;
    b2.prev = bp;

    // run earcut on each half
    earcutLinked(a, ccw, triangles);
    earcutLinked(a2, ccw, triangles);
}

function orient(p, q, r) {
    return Math.sign((q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]));
}

function intersects(p1, q1, p2, q2) {
    return orient(p1, q1, p2) !== orient(p1, q1, q2) &&
           orient(p2, q2, p1) !== orient(p2, q2, q1);
}

function intersectsPolygon(start, a, b) {
    var node = start;
    do {
        var p1 = node.p,
            p2 = node.next.p;

        if (p1 !== a && p2 !== a && p1 !== b && p2 !== b && intersects(p1, p2, a, b)) return true;

        node = node.next;
    } while (node !== start);

    return false;
}

function locallyInside(a, b, ccw) {
    var sign = ccw ? -1 : 1;
    return orient(a.prev.p, a.p, a.next.p) === sign ?
        orient(a.p, b.p, a.next.p) !== sign && orient(a.p, a.prev.p, b.p) !== sign :
        orient(a.p, b.p, a.prev.p) === sign || orient(a.p, a.next.p, b.p) === sign;
}

function middleInside(start, a, b) {
    var node = start,
        inside = false,
        px = (a[0] + b[0]) / 2,
        py = (a[1] + b[1]) / 2;
    do {
        var p1 = node.p,
            p2 = node.next.p;

        if (((p1[1] > py) !== (p2[1] > py)) && (px < (p2[0] - p1[0]) * (py - p1[1]) / (p2[1] - p1[1]) + p1[0])) {
            inside = !inside;
        }
        node = node.next;
    } while (node !== start);

    return inside;
}
