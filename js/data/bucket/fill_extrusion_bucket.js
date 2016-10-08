'use strict';

var Bucket = require('../bucket');
var util = require('../../util/util');
var loadGeometry = require('../load_geometry');
var earcut = require('earcut');
var classifyRings = require('../../util/classify_rings');
var Point = require('point-geometry');
var EARCUT_MAX_RINGS = 500;

module.exports = FillExtrusionBucket;

function FillExtrusionBucket() {
    Bucket.apply(this, arguments);
}

FillExtrusionBucket.prototype = util.inherit(Bucket, {});

FillExtrusionBucket.prototype.programInterfaces = {
    fillextrusion: {
        layoutVertexArrayType: new Bucket.VertexArrayType([{
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
        }]),
        elementArrayType: new Bucket.ElementArrayType(3),

        paintAttributes: [{
            name: 'a_minH',
            components: 1,
            type: 'Uint16',
            getValue: function(layer, globalProperties, featureProperties) {
                return [layer.getPaintValue("fill-extrude-base", globalProperties, featureProperties)];
            },
            multiplier: 1,
            paintProperty: 'fill-extrude-base'
        }, {
            name: 'a_maxH',
            components: 1,
            type: 'Uint16',
            getValue: function(layer, globalProperties, featureProperties) {
                return [layer.getPaintValue("fill-extrude-height", globalProperties, featureProperties)];
            },
            multiplier: 1,
            paintProperty: 'fill-extrude-height'
        }, {
            name: 'a_color',
            components: 4,
            type: 'Uint8',
            getValue: function(layer, globalProperties, featureProperties) {
                var color = layer.getPaintValue("fill-color", globalProperties, featureProperties);
                color[3] = 1.0;
                return color;
            },
            multiplier: 255,
            paintProperty: 'fill-color'
        }]
    }
};

FillExtrusionBucket.prototype.addVertex = function(vertexArray, x, y, nx, ny, nz, t, e) {
    return vertexArray.emplaceBack(
        // a_pos
        x,
        y,
        // a_normal
        Math.floor(nx * this.factor) * 2 + t,
        ny * this.factor * 2,
        nz * this.factor * 2,

        // a_edgedistance
        Math.round(e)
        );
};

FillExtrusionBucket.prototype.addFeature = function(feature) {
    var lines = loadGeometry(feature);
    var polygons = convertCoords(classifyRings(lines, EARCUT_MAX_RINGS));

    this.factor = Math.pow(2, 13);

    var startGroup = this.prepareArrayGroup('fillextrusion', 0);
    var startIndex = startGroup.layoutVertexArray.length;

    for (var i = 0; i < polygons.length; i++) {
        this.addPolygon(polygons[i]);
    }

    this.populatePaintArrays('fillextrusion', {zoom: this.zoom}, feature.properties, startGroup, startIndex);
};

FillExtrusionBucket.prototype.addPolygon = function(polygon) {
    var numVertices = 0;
    for (var k = 0; k < polygon.length; k++) {
        numVertices += polygon[k].length;
    }
    numVertices *= 5;

    var group = this.prepareArrayGroup('fillextrusion', numVertices);
    var flattened = [];
    var holeIndices = [];

    var indices = [];

    for (var r = 0; r < polygon.length; r++) {
        var ring = polygon[r];

        if (r > 0) holeIndices.push(flattened.length / 2);

        var edgeDistance = 0;

        for (var v = 0; v < ring.length; v++) {
            var v1 = ring[v];

            var index = this.addVertex(group.layoutVertexArray, v1[0], v1[1], 0, 0, 1, 1, 0);
            indices.push(index);

            if (v >= 1) {
                var v2 = ring[v - 1];

                if (!isBoundaryEdge(v1, v2)) {
                    var perp = Point.convert(v1)._sub(Point.convert(v2))._perp()._unit();

                    var bottomRight = this.addVertex(group.layoutVertexArray, v1[0], v1[1], perp.x, perp.y, 0, 0, edgeDistance);
                    this.addVertex(group.layoutVertexArray, v1[0], v1[1], perp.x, perp.y, 0, 1, edgeDistance);

                    edgeDistance += Point.convert(v2).dist(Point.convert(v1));

                    this.addVertex(group.layoutVertexArray, v2[0], v2[1], perp.x, perp.y, 0, 0, edgeDistance);
                    this.addVertex(group.layoutVertexArray, v2[0], v2[1], perp.x, perp.y, 0, 1, edgeDistance);

                    group.elementArray.emplaceBack(bottomRight, bottomRight + 1, bottomRight + 2);
                    group.elementArray.emplaceBack(bottomRight + 1, bottomRight + 2, bottomRight + 3);
                }
            }

            // convert to format used by earcut
            flattened.push(v1[0]);
            flattened.push(v1[1]);
        }
    }

    var triangleIndices = earcut(flattened, holeIndices);

    for (var j = 0; j < triangleIndices.length - 2; j += 3) {
        group.elementArray.emplaceBack(indices[triangleIndices[j]],
            indices[triangleIndices[j + 1]],
            indices[triangleIndices[j + 2]]);
    }
};

function convertCoords(rings) {
    if (rings instanceof Point) return [rings.x, rings.y];
    return rings.map(convertCoords);
}

function isBoundaryEdge(v1, v2) {
    return v1.some(function(a, i) {
        return isOutside(v2[i]) && v2[i] === a;
    });
}

function isOutside(coord) {
    return coord < 0 || coord > Bucket.EXTENT;
}
