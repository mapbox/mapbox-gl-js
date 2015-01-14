'use strict';

var ElementGroups = require('./element_groups');
var libtess = require('libtess');

var tesselator = initTesselator();

module.exports = FillBucket;

function FillBucket(layoutProperties, buffers, placement, elementGroups) {
    this.layoutProperties = layoutProperties;
    this.buffers = buffers;
    this.elementGroups = elementGroups || new ElementGroups(buffers.fillVertex, buffers.fillElement, buffers.outlineElement);
}

FillBucket.prototype.addFeatures = function() {
    var features = this.features;
    var fillVertex = this.buffers.fillVertex;
    var fillElement = this.buffers.fillElement;
    tesselator.gluTessCallback(libtess.gluEnum.GLU_TESS_VERTEX_DATA, addVertex);

    var n = 0;
    var elementGroups = this.elementGroups;

    var start = self.performance.now();
    self.tesselateTime = self.tesselateTime || 0;

    // features = features.reverse();

    var elementGroup;
    for (var i = features.length - 1; i >= 0; i--) {
        var feature = features[i];
        var lines = feature.loadGeometry();

        if (lines.length > 1) {
            tesselator.gluTessBeginPolygon();
            for (var k = 0; k < lines.length; k++) {
                var vertices = lines[k];

                tesselator.gluTessBeginContour();
                for (var m = 0; m < vertices.length; m++) {
                    var coords = [vertices[m].x, vertices[m].y, 0];
                    tesselator.gluTessVertex(coords, coords);
                }
                tesselator.gluTessEndContour();
            }
            tesselator.gluTessEndPolygon();
            // console.count('complex');

        } else {
            // console.count('simple');
            var contour = [];
            var vertices = lines[0];
            for (var m = 1; m < vertices.length; m++) {
                var x = vertices[m].x,
                    y = vertices[m].y;
                if (vertices[m - 1].x !== x || vertices[m - 1].y !== y) contour.push([x, y]);
            }
            if (!contour.length) continue;
            var triangles = earcut(contour);

            for (var m = 0; m < triangles.length; m++) {
                for (var z = 0; z < 3; z++) {
                    addVertex(triangles[m][z]);
                }
            }
        }
    }

    self.tesselateTime += self.performance.now() - start;
    console.log(Math.round(self.tesselateTime) + ' ms');

    function addVertex(data) {
        if (n % 3 === 0) {
            elementGroups.makeRoomFor(10);
            elementGroup = elementGroups.current;
        }
        var index = fillVertex.index - elementGroup.vertexStartIndex;
        fillVertex.add(data[0], data[1]);
        fillElement.add(index);
        elementGroup.elementLength++;
        n++;
    }
};

FillBucket.prototype.hasData = function() {
    return !!this.elementGroups.current;
};

function initTesselator() {
    var tesselator = new libtess.GluTesselator();
    tesselator.gluTessCallback(libtess.gluEnum.GLU_TESS_COMBINE, function(coords) { return coords; });
    tesselator.gluTessCallback(libtess.gluEnum.GLU_TESS_EDGE_FLAG, function() {});
    tesselator.gluTessNormal(0, 0, 1);
    return tesselator;
}


// 'use strict';

// module.exports = earcut;

function earcut(points) {

    var sum = 0,
        len = points.length,
        i, j, last;

    // create a doubly linked list from polygon points, detecting winding order along the way
    for (i = 0, j = len - 1; i < len; j = i++) {
        last = insertNode(points[i], last);
        sum += (points[i][0] - points[j][0]) * (points[i][1] + points[j][1]);
    }
    var clockwise = sum < 0;

    var node = last;
    do {
        if (clipped(node.p, node.next.p, node.next.next.p)) {
            var removed = node.next;
            node.next = removed.next;
            removed.next.prev = node;
            if (removed === last) break;
            continue;
        }
        node = node.next;
    } while (node !== last)

    var triangles = [];
    earcutLinked(node, clockwise, triangles);
    return triangles;
}

function clipped(p1, p2, p3) {
    return (p1[0] === p2[0] && p2[0] === p3[0]) || (p1[1] === p2[1] && p2[1] === p3[1]);
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
            triangles.push([prev.p, ear.p, next.p]);
            ear.next.prev = prev;
            ear.prev.next = next;
            stop = next;
            k = 0;
        }
        ear = next;
        k++;

        if (ear.next === stop) {
            splitEarcut(ear, clockwise, triangles);
            break;
        }
        if (k > 10000) {
            throw new Error('infinite loop, should never happen');
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
    var a = start,
        split = false;
    do {
        var b = a.next.next;
        while (b !== a.prev) {
            if (middleInside(start, a.p, b.p) && !intersectsPolygon(start, a.p, b.p)) {
                split = true;
                break;
            }
            b = b.next;
        }
        if (split) break;
        a = a.next;
    } while (a !== start)

    if (!split) return;

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
    } while (node !== start)

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
    } while (node !== start)

    return inside;
}
