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
    }
};

FillBucket.prototype.addVertex = function(vertexArray, x, y) {
    return vertexArray.emplaceBack(x, y);
};

FillBucket.prototype.addFeature = function(feature) {
    var lines = loadGeometry(feature);
    var polygons = convertCoords(classifyRings(lines, EARCUT_MAX_RINGS));

    this.factor = Math.pow(2, 13);

    var startGroup = this.prepareArrayGroup('fill', 0);
    var startIndex = startGroup.layoutVertexArray.length;

    for (var i = 0; i < polygons.length; i++) {
        this.addPolygon(polygons[i]);
    }

    this.populatePaintArrays('fill', {zoom: this.zoom}, feature.properties, startGroup, startIndex);
};

FillBucket.prototype.addPolygon = function(polygon) {
    var numVertices = 0;
    for (var k = 0; k < polygon.length; k++) {
        numVertices += polygon[k].length;
    }

    var group = this.prepareArrayGroup('fill', numVertices);
    var flattened = [];
    var holeIndices = [];
    var startIndex = group.layoutVertexArray.length;

    var indices = [];

    for (var r = 0; r < polygon.length; r++) {
        var ring = polygon[r];

        if (r > 0) holeIndices.push(flattened.length / 2);

        for (var v = 0; v < ring.length; v++) {
            var v1 = ring[v];

            var index = this.addVertex(group.layoutVertexArray, v1[0], v1[1], 0, 0, 1, 1, 0);
            indices.push(index);

            if (v >= 1) {
                group.elementArray2.emplaceBack(index - 1, index);
            }

            // convert to format used by earcut
            flattened.push(v1[0]);
            flattened.push(v1[1]);
        }
    }

    var triangleIndices = earcut(flattened, holeIndices);

    for (var i = 0; i < triangleIndices.length; i++) {
        group.elementArray.emplaceBack(triangleIndices[i] + startIndex);
    }
};

function convertCoords(rings) {
    if (rings instanceof Point) return [rings.x, rings.y];
    return rings.map(convertCoords);
}
