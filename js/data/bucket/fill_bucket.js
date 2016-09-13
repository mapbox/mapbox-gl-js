'use strict';

var Bucket = require('../bucket');
var util = require('../../util/util');
var loadGeometry = require('../load_geometry');
var earcut = require('earcut');
var classifyRings = require('../../util/classify_rings');
var Point = require('point-geometry');
var EARCUT_MAX_RINGS = 500;

module.exports = FillBucket;

function FillBucket() {
    Bucket.apply(this, arguments);
}

FillBucket.prototype = util.inherit(Bucket, {});

FillBucket.prototype.programInterfaces = {
    fill: {
        layoutVertexArrayType: new Bucket.VertexArrayType([{
            name: 'a_pos',
            components: 2,
            type: 'Int16'
        }]),
        elementArrayType: new Bucket.ElementArrayType(1),
        elementArrayType2: new Bucket.ElementArrayType(2),

        paintAttributes: [{
            name: 'a_color',
            components: 4,
            type: 'Uint8',
            getValue: function(layer, globalProperties, featureProperties) {
                return layer.getPaintValue("fill-color", globalProperties, featureProperties);
            },
            multiplier: 255,
            paintProperty: 'fill-color'
        }, {
            name: 'a_outline_color',
            components: 4,
            type: 'Uint8',
            getValue: function(layer, globalProperties, featureProperties) {
                return layer.getPaintValue("fill-outline-color", globalProperties, featureProperties);
            },
            multiplier: 255,
            paintProperty: 'fill-outline-color'
        }, {
            name: 'a_opacity',
            components: 1,
            type: 'Uint8',
            getValue: function(layer, globalProperties, featureProperties) {
                return [layer.getPaintValue("fill-opacity", globalProperties, featureProperties)];
            },
            multiplier: 255,
            paintProperty: 'fill-opacity'
        }]
    },

    extrusion: {
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
        elementArrayType2: new Bucket.ElementArrayType(2),

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

FillBucket.prototype.addVertex = function(vertexArray, x, y, nx, ny, nz, t, e) {
    if (this.fillType === 'fill') {
        return vertexArray.emplaceBack(
            // a_pos
            x,
            y
            );
    } else {
        return vertexArray.emplaceBack(
            // a_pos
            x,
            y,
            // a_normal
            Math.floor(nx * this.factor) * 2 + t,
            ny * this.factor * 2,
            nz * this.factor * 2,

            // a_edgedistance
            e
            );
    }
};

FillBucket.prototype.addFeature = function(feature) {
    var lines = loadGeometry(feature);
    var polygons = convertCoords(classifyRings(lines, EARCUT_MAX_RINGS));

    if (this.layer.isPaintValueFeatureConstant('fill-extrude-height') && this.layer.isPaintValueZoomConstant('fill-extrude-height') && this.layer.getPaintValue('fill-extrude-height') === 0) {
        this.fillType = 'fill';
    } else {
        this.fillType = 'extrusion';
    }

    this.factor = Math.pow(2, 13);

    var startGroup = this.prepareArrayGroup(this.fillType, 0);
    var startIndex = startGroup.layoutVertexArray.length;

    for (var i = 0; i < polygons.length; i++) {
        this.addPolygon(polygons[i]);
    }

    this.populatePaintArrays(this.fillType, {zoom: this.zoom}, feature.properties, startGroup, startIndex);
};

FillBucket.prototype.addPolygon = function(polygon) {
    var numVertices = 0;
    for (var k = 0; k < polygon.length; k++) {
        numVertices += polygon[k].length;
    }
    if (this.fillType === 'extrusion') numVertices *= 5;

    var group = this.prepareArrayGroup(this.fillType, numVertices);
    var flattened = [];
    var holeIndices = [];
    var startIndex = group.layoutVertexArray.length;

    var indices = [];

    for (var r = 0; r < polygon.length; r++) {
        var ring = polygon[r];

        if (r > 0) holeIndices.push(flattened.length / 2);

        var edgeDistance = 0;

        for (var v = 0; v < ring.length; v++) {
            var v1 = ring[v];
            checkBoundaries(v1);

            var index = this.addVertex(group.layoutVertexArray, v1[0], v1[1], 0, 0, 1, 1, 0);
            indices.push(index);

            if (v >= 1) {
                if (this.fillType === 'extrusion') {
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

                        if (!v1.isOutside) {
                            group.elementArray2.emplaceBack(bottomRight, bottomRight + 1); // "right"
                        }
                        if (!v2.isOutside) {
                            group.elementArray2.emplaceBack(bottomRight + 2, bottomRight + 3); // "left"
                        }
                        group.elementArray2.emplaceBack(bottomRight, bottomRight + 2); // bottom
                        group.elementArray2.emplaceBack(bottomRight + 1, bottomRight + 3); // top
                    }
                } else {
                    group.elementArray2.emplaceBack(index - 1, index);
                }
            }

            // convert to format used by earcut
            flattened.push(v1[0]);
            flattened.push(v1[1]);
        }
    }

    var triangleIndices = earcut(flattened, holeIndices);

    if (this.fillType === 'fill') {
        for (var i = 0; i < triangleIndices.length; i++) {
            group.elementArray.emplaceBack(triangleIndices[i] + startIndex);
        }
    } else {
        for (var j = 0; j < triangleIndices.length - 2; j += 3) {
            group.elementArray.emplaceBack(indices[triangleIndices[j]],
                indices[triangleIndices[j + 1]],
                indices[triangleIndices[j + 2]]);
        }
    }
};

function convertCoords(rings) {
    if (rings instanceof Point) return [rings.x, rings.y];
    return rings.map(convertCoords);
}

function isBoundaryEdge(v1, v2) {
    if (!v1.isOutside || !v2.isOutside) return false;
    return v1.some(function(a, i) { return v2[i] === a; });
}

function checkBoundaries(point) {
    point.isOutside = point.some(function(c) { return c < 0 || c > Bucket.EXTENT; });
}
