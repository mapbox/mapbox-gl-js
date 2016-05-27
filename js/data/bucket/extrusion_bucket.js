'use strict';

var Bucket = require('../bucket');
var util = require('../../util/util');
var loadGeometry = require('../load_geometry');
var earcut = require('earcut');
var classifyRings = require('../../util/classify_rings');
var Point = require('point-geometry');

module.exports = ExtrusionBucket;

function ExtrusionBucket() {
    Bucket.apply(this, arguments);
}

ExtrusionBucket.prototype = util.inherit(Bucket, {});


ExtrusionBucket.prototype.addExtrusionVertex = function(vertexBuffer, x, y, z, nx, ny, nz, t) {
    const factor = Math.pow(2, 13);

    return vertexBuffer.emplaceBack(
            // a_pos
            x,
            y,
            z,

            // a_normal
            Math.floor(nx * factor) * 2 + t,
            ny * factor * 2,
            nz * factor * 2);
};

ExtrusionBucket.prototype.programInterfaces = {
    extrusion: {
        vertexBuffer: true,
        elementBuffer: true,
        elementBufferComponents: 3,
        elementBuffer2: true,
        elementBuffer2Components: 2,


        layoutAttributes: [{
            name: 'a_pos',
            components: 3,
            type: 'Int16'
        }, {
            name: 'a_normal',
            components: 3,
            type: 'Int16'
        }]
    }
};

ExtrusionBucket.prototype.addFeature = function(feature) {
    var levels = feature.properties && feature.properties.levels || 3;

    var lines = loadGeometry(feature);
    var polygons = convertCoords(classifyRings(lines));
    for (var i = 0; i < polygons.length; i++) {
        this.addPolygon(polygons[i], levels);
    }
};

ExtrusionBucket.prototype.addPolygon = function(polygon, levels) {
    var numVertices = 0;
    for (var k = 0; k < polygon.length; k++) {
        numVertices += polygon[k].length;
    }

    var group = this.makeRoomFor('extrusion', numVertices);
    var flattened = [];
    var holeIndices = [];
    var startIndex = group.layout.vertex.length;

    var h = levels * 3;

    var indices = [];

    for (var r = 0; r < polygon.length; r++) {
        var ring = polygon[r];

        if (r > 0) holeIndices.push(flattened.length / 2);

        // add vertices from the roof
        for (var v = 0; v < ring.length; v++) {
            var vertex = ring[v];

            var fIndex = this.addExtrusionVertex(group.layout.vertex, vertex[0], vertex[1], h, 0, 0, 1, 1);
            indices.push(fIndex);

            if (v >= 1) {
                group.layout.element2.emplaceBack(fIndex - 1, fIndex);
            }

            // convert to format used by earcut
            flattened.push(vertex[0]);
            flattened.push(vertex[1]);
        }

        for (var s = 0; s < ring.length - 1; s++) {
            var v1 = ring[s];
            var v2 = ring[s + 1];
            var perp = Point.convert(v2)._sub(Point.convert(v1))._perp()._unit();

            var vertexArray = group.layout.vertex;
            var wIndex = this.addExtrusionVertex(vertexArray, v1[0], v1[1], 0, perp.x, perp.y, 0, 0);
            this.addExtrusionVertex(vertexArray, v1[0], v1[1], h, perp.x, perp.y, 0, 1);
            this.addExtrusionVertex(vertexArray, v2[0], v2[1], 0, perp.x, perp.y, 0, 0);
            this.addExtrusionVertex(vertexArray, v2[0], v2[1], h, perp.x, perp.y, 0, 1);

            group.layout.element.emplaceBack(wIndex, wIndex + 1, wIndex + 2);
            group.layout.element.emplaceBack(wIndex + 1, wIndex + 2, wIndex + 3);
        }
    }

    var triangleIndices = earcut(flattened, holeIndices);

    for (var i = 0; i < triangleIndices.length - 2; i += 3) {
        group.layout.element.emplaceBack(indices[triangleIndices[i]],
                indices[triangleIndices[i+1]],
                indices[triangleIndices[i+2]]);
    }
};

function convertCoords(rings) {
    if (rings instanceof Point) return [rings.x, rings.y];
    return rings.map(convertCoords);
}
