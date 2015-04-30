'use strict';

var ElementGroups = require('./element_groups');
var earcut = require('earcut');
var classifyRings = require('../util/classify_rings');

module.exports = FillBucket;

function FillBucket(buffers) {
    this.buffers = buffers;
    this.elementGroups = new ElementGroups(buffers.fillVertex, buffers.fillElement, buffers.outlineElement);
}

FillBucket.prototype.addFeatures = function() {
    var start = self.performance.now();
    self.tesselateTime = self.tesselateTime || 0;

    var features = this.features;
    for (var i = this.features.length - 1; i >= 0; i--) {
        var feature = features[i];
        this.addFeature(feature.loadGeometry());
    }

    self.tesselateTime += self.performance.now() - start;
};

FillBucket.prototype.addFeature = function(lines) {
    var polygons = classifyRings(convertCoords(lines));
    for (var i = 0; i < polygons.length; i++) {
        this.addPolygon(polygons[i]);
    }
};

FillBucket.prototype.addPolygon = function(polygon) {

    var numVertices = 0;
    for (var k = 0; k < polygon.length; k++) {
        numVertices += polygon[k].length;
    }

    var fillVertex = this.buffers.fillVertex,
        fillElement = this.buffers.fillElement,
        outlineElement = this.buffers.outlineElement,
        elementGroup = this.elementGroups.makeRoomFor(numVertices),
        startIndex = fillVertex.index - elementGroup.vertexStartIndex,
        flattened = [],
        holeIndices = [],
        prevIndex;

    for (var r = 0; r < polygon.length; r++) {
        var ring = polygon[r];
        prevIndex = undefined;

        if (r > 0) holeIndices.push(flattened.length / 2);

        for (var v = 0; v < ring.length; v++) {
            var vertex = ring[v];

            var currentIndex = fillVertex.index - elementGroup.vertexStartIndex;
            fillVertex.add(vertex[0], vertex[1]);
            elementGroup.vertexLength++;

            if (v >= 1) {
                outlineElement.add(prevIndex, currentIndex);
                elementGroup.secondElementLength++;
            }

            prevIndex = currentIndex;

            // convert to format used by earcut
            flattened.push(vertex[0]);
            flattened.push(vertex[1]);
        }
    }

    var triangleIndices = earcut(flattened, holeIndices);

    for (var i = 0; i < triangleIndices.length; i++) {
        fillElement.add(triangleIndices[i] + startIndex);
        elementGroup.elementLength += 1;
    }
};

function convertCoords(rings) {
    var result = [];
    for (var i = 0; i < rings.length; i++) {
        var ring = [];
        for (var j = 0; j < rings[i].length; j++) {
            var p = rings[i][j];
            ring.push([p.x, p.y]);
        }
        result.push(ring);
    }
    return result;
}
