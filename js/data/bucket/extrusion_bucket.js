'use strict';

var Bucket = require('../bucket');
var util = require('../../util/util');
var loadGeometry = require('../load_geometry');
var earcut = require('earcut');
var classifyRings = require('../../util/classify_rings');
var Point = require('point-geometry');
var EARCUT_MAX_RINGS = 500;

module.exports = ExtrusionBucket;

function ExtrusionBucket() {
    Bucket.apply(this, arguments);
}

ExtrusionBucket.prototype = util.inherit(Bucket, {});


ExtrusionBucket.prototype.addExtrusionVertex = function(vertexBuffer, x, y, nx, ny, nz, t, e) {
    const factor = Math.pow(2, 13);

    return vertexBuffer.emplaceBack(
            // a_pos
            x,
            y,

            // a_normal
            Math.floor(nx * factor) * 2 + t,
            ny * factor * 2,
            nz * factor * 2,

            // a_edgedistance
            e
            );
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
            components: 2,
            type: 'Int16'
        }, {
            name: 'a_normal',
            components: 3,
            type: 'Int16'
        }, {
            name: 'a_edgedistance',
            components: 1,
            type: 'Int16'
        }],
        paintAttributes: [{
            name: 'a_minH',
            components: 1,
            type: 'Uint16',
            isLayerConstant: false, // what is this
            getValue: function(layer, globalProperties, featureProperties) {
                return [layer.getPaintValue("extrusion-min-height", globalProperties, featureProperties)];
            },
            multiplier: 1,
            paintProperty: 'extrusion-min-height'
        }, {
            name: 'a_maxH',
            components: 1,
            type: 'Uint16',
            isLayerConstant: false, // what is this
            getValue: function(layer, globalProperties, featureProperties) {
                return [layer.getPaintValue("extrusion-height", globalProperties, featureProperties)];
            },
            multiplier: 1,
            paintProperty: 'extrusion-height'
        }, {
            name: 'a_color',
            components: 4,
            type: 'Uint8',
            getValue: function(layer, globalProperties, featureProperties) {
                return layer.getPaintValue("extrusion-color", globalProperties, featureProperties);
            },
            multiplier: 255,
            paintProperty: 'extrusion-color'
        }]
    }
};

ExtrusionBucket.prototype.addFeature = function(feature) {
    var lines = loadGeometry(feature);
    var polygons = convertCoords(classifyRings(lines, EARCUT_MAX_RINGS));
    for (var i = 0; i < polygons.length; i++) {
        this.addPolygon(polygons[i], feature);
    }
};

ExtrusionBucket.prototype.addPolygon = function(polygon, feature) {
    var numVertices = 0;
    for (var k = 0; k < polygon.length; k++) {
        numVertices += polygon[k].length;
    }

    var group = this.makeRoomFor('extrusion', numVertices);
    var flattened = [];
    var holeIndices = [];
    var startIndex = group.layout.vertex.length;

    var indices = [];

    for (var r = 0; r < polygon.length; r++) {
        var ring = polygon[r];

        if (r > 0) holeIndices.push(flattened.length / 2);

        var edgeDistance = 0;
        var lastIndex;

        // add vertices from the roof
        for (var v = 0; v < ring.length; v++) {
            var v1 = ring[v];

            var topIndex = this.addExtrusionVertex(group.layout.vertex, v1[0], v1[1], 0, 0, 1, 1, 0);
            indices.push(topIndex);

            if (v >= 1) {
                var v2 = ring[v - 1];
                var perp = Point.convert(v1)._sub(Point.convert(v2))._perp()._unit();
                var vertexArray = group.layout.vertex;

                var bottomRight = this.addExtrusionVertex(vertexArray, v1[0], v1[1], perp.x, perp.y, 0, 0, edgeDistance);
                this.addExtrusionVertex(vertexArray, v1[0], v1[1], perp.x, perp.y, 0, 1, edgeDistance);

                // track distance from first edge for pattern wrapping
                edgeDistance += Point.convert(v2).dist(Point.convert(v1));

                this.addExtrusionVertex(vertexArray, v2[0], v2[1], perp.x, perp.y, 0, 0, edgeDistance);
                this.addExtrusionVertex(vertexArray, v2[0], v2[1], perp.x, perp.y, 0, 1, edgeDistance);

                group.layout.element.emplaceBack(bottomRight, bottomRight + 1, bottomRight + 2);
                group.layout.element.emplaceBack(bottomRight + 1, bottomRight + 2, bottomRight + 3);

                if (!isBoundaryEdge(v1, ring[v - 1])) {
                    group.layout.element2.emplaceBack(bottomRight, bottomRight + 1);  // "right"
                    group.layout.element2.emplaceBack(bottomRight + 2, bottomRight + 3);  // "left"
                    group.layout.element2.emplaceBack(bottomRight, bottomRight + 2);  // bottom
                    group.layout.element2.emplaceBack(bottomRight + 1, bottomRight + 3);  // top
                }
            }

            // convert to format used by earcut
            flattened.push(v1[0]);
            flattened.push(v1[1]);

            lastIndex = topIndex;
        }
    }

    var triangleIndices = earcut(flattened, holeIndices);

    for (var i = 0; i < triangleIndices.length - 2; i += 3) {
        group.layout.element.emplaceBack(indices[triangleIndices[i]],
                indices[triangleIndices[i+1]],
                indices[triangleIndices[i+2]]);
    }

    this.populatePaintArrays('extrusion', {zoom: this.zoom}, feature.properties, group, startIndex);
};

function convertCoords(rings) {
    if (rings instanceof Point) return [rings.x, rings.y];
    return rings.map(convertCoords);
}

function isBoundaryEdge(v1, v2) {
    return v1.some((a, i) => (a === 0 - 64 || a === Bucket.EXTENT + 64) && v2[i] === a);
}
