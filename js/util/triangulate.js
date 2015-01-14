'use strict';

module.exports = triangulate;

function triangulate(points) {

    var sum = 0,
        len = points.length,
        i, j, last;

    // create a doubly linked list from polygon points, detecting winding order along the way
    for (i = 0, j = len - 1; i < len; j = i++) {
        last = insertNode(points[i], last);
        sum += (points[i][0] - points[j][0]) * (points[i][1] + points[j][1]);
    }

    // eliminate vertically or horizontally colinear points (clipping-induced)
    var node = last;
    do {
        var next = node.next;
        if (equals(node.p, next.p) || clipped(node.p, next.p, next.next.p)) {
            node.next = next.next;
            next.next.prev = node;
            if (next === last) break;
            continue;
        }
        node = next;
    } while (node !== last);

    var triangles = [],
        clockwise = sum < 0;

    earcutLinked(node, clockwise, triangles);

    return triangles;
}

function clipped(p1, p2, p3) {
    return (p1[0] === p2[0] && p2[0] === p3[0]) || (p1[1] === p2[1] && p2[1] === p3[1]);
}

function equals(p1, p2) {
    return p1[0] === p2[0] && p1[1] === p2[1];
}

function earcutLinked(ear, clockwise, triangles) {
    var stop = ear,
        k = 0,
        prev, next;

    // iterate through ears, slicing them one by one
    while (ear.prev !== ear.next) {
        prev = ear.prev;
        next = ear.next;

        if (isEar(ear, clockwise)) {
            triangles.push(prev.p, ear.p, next.p);
            next.prev = prev;
            prev.next = next;
            stop = next;
            k = 0;
        }
        ear = next;
        k++;

        if (ear.next === stop) {
            // if we can't find valid ears anymore, split remaining polygon into two
            splitEarcut(ear, clockwise, triangles);
            break;
        }
    }
}

// iterate through points to check if there's a reflex point inside a potential ear
function isEar(ear, clockwise) {

    var a = ear.prev.p,
        b = ear.p,
        c = ear.next.p,

        ax = a[0], bx = b[0], cx = c[0],
        ay = a[1], by = b[1], cy = c[1],

        abd = ax * by - ay * bx,
        acd = ax * cy - ay * cx,
        cbd = cx * by - cy * bx,
        A = abd - acd - cbd;

    if (clockwise !== (A > 0)) return false; // reflex

    var sign = clockwise ? 1 : -1,
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

function splitEarcut(start, clockwise, triangles) {

    // find a valid diagonal that divides the polygon into two
    var a = start,
        split, b;
    do {
        b = a.next.next;
        while (b !== a.prev) {
            if (middleInside(start, a.p, b.p) && !intersectsPolygon(start, a.p, b.p)) {
                splitEarcutByDiag(a, b, clockwise, triangles);
                return;
            }
            b = b.next;
        }
        if (split) break;
        a = a.next;
    } while (a !== start);
}

function splitEarcutByDiag(a, b, clockwise, triangles) {
    // split the polygon vertices circular doubly-linked linked list into two
    var a2 = {
        p: a.p,
        prev: null,
        next: null
    };
    var b2 = {
        p: b.p,
        prev: null,
        next: null
    };

    var an = a.next;
    var bp = b.prev;

    a.next = b;
    b.prev = a;

    a2.next = an;
    a2.prev = b2;

    b2.next = a2;
    b2.prev = bp;

    an.prev = a2;

    bp.next = b2;

    // run earcut on each half
    earcutLinked(a, clockwise, triangles);
    earcutLinked(a2, clockwise, triangles);
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
