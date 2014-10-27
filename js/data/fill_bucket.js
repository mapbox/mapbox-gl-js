'use strict';

var ElementGroups = require('./element_groups');
var libtess = require('libtess');

var tesselator = initTesselator();

module.exports = FillBucket;

function FillBucket(buffers) {
    this.buffers = buffers;
    this.elementGroups = new ElementGroups(buffers.fillVertex, buffers.fillElement, buffers.outlineElement);
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

    var triangles = [],
        sum = 0,
        len = points.length,
        i, j, last, clockwise, ear, prev, next;

    // create a doubly linked list from polygon points, detecting winding order along the way
    for (i = 0, j = len - 1; i < len; j = i++) {
        last = insertNode(points[i], last);
        sum += (points[i][0] - points[j][0]) * (points[i][1] + points[j][1]);
    }
    clockwise = sum < 0;

    var k = 0;

    // iterate through ears, slicing them one by one
    ear = last;
    while (len > 2) {
        prev = ear.prev;
        next = ear.next;

        if (len === 3 || isEar(ear, clockwise)) {
            triangles.push([prev.p, ear.p, next.p]);
            ear.next.prev = ear.prev;
            ear.prev.next = ear.next;
            len--;
            k = 0;
        }
        ear = next;
        k++;
        if (k > len) {
            // console.log(ear);
            break;
        }
    }

    return triangles;
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

