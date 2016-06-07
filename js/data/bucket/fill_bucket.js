'use strict';

var Bucket = require('../bucket');
var util = require('../../util/util');
var loadGeometry = require('../load_geometry');
var earcut = require('earcut');
var classifyRings = require('../../util/classify_rings');
var EARCUT_MAX_RINGS = 500;

module.exports = FillBucket;

function FillBucket() {
    Bucket.apply(this, arguments);
}

FillBucket.prototype = util.inherit(Bucket, {});

FillBucket.prototype.programInterfaces = {
    fill: {
        vertexBuffer: true,
        elementBuffer: true,
        elementBufferComponents: 1,
        elementBuffer2: true,
        elementBuffer2Components: 2,

        layoutAttributes: [{
            name: 'a_pos',
            components: 2,
            type: 'Int16'
        }],
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
        }]
    }
};

FillBucket.prototype.addFeature = function(feature) {
    var lines = loadGeometry(feature);
    var polygons = classifyRings(lines, EARCUT_MAX_RINGS);

    var startGroup = this.makeRoomFor('fill', 0);
    var startIndex = startGroup.layout.vertex.length;

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

    var group = this.makeRoomFor('fill', numVertices);
    var flattened = [];
    var holeIndices = [];
    var startIndex = group.layout.vertex.length;

    for (var r = 0; r < polygon.length; r++) {
        var ring = polygon[r];

        if (r > 0) holeIndices.push(flattened.length / 2);

        for (var v = 0; v < ring.length; v++) {
            var vertex = ring[v];

            var index = group.layout.vertex.emplaceBack(vertex.x, vertex.y);

            if (v >= 1) {
                group.layout.element2.emplaceBack(index - 1, index);
            }

            // convert to format used by earcut
            flattened.push(vertex.x);
            flattened.push(vertex.y);
        }
    }

    var triangleIndices = earcut(flattened, holeIndices);

    for (var i = 0; i < triangleIndices.length; i++) {
        group.layout.element.emplaceBack(triangleIndices[i] + startIndex);
    }
};
