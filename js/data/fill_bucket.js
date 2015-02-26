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
    var i;
    for (i = 0; i < lines.length; i++) {
        this.addOutline(lines[i]);
    }

    var polygons = classifyRings(convertCoords(lines));
    for (i = 0; i < polygons.length; i++) {
        this.addFill(polygons[i]);
    }
};

FillBucket.prototype.addFill = function(polygon) {
    var fillVertex = this.buffers.fillVertex,
        fillElement = this.buffers.fillElement,
        triangles = earcut(polygon),
        elementGroup = this.elementGroups.makeRoomFor(triangles.length);

    for (var i = 0; i < triangles.length; i++) {
        var index = fillVertex.index - elementGroup.vertexStartIndex;
        fillVertex.add(triangles[i][0], triangles[i][1]);
        fillElement.add(index);
        elementGroup.elementLength++;
        elementGroup.vertexLength++;
    }
};

FillBucket.prototype.addOutline = function(vertices) {
    var elementGroup = this.elementGroups.makeRoomFor(vertices.length),
        fillVertex = this.buffers.fillVertex,
        outlineElement = this.buffers.outlineElement,
        currentIndex, prevIndex, vertex, i;

    for (i = 0; i < vertices.length; i++) {
        vertex = vertices[i];

        currentIndex = fillVertex.index - elementGroup.vertexStartIndex;
        fillVertex.add(vertex.x, vertex.y);
        elementGroup.vertexLength++;

        if (i >= 1) {
            outlineElement.add(prevIndex, currentIndex);
            elementGroup.secondElementLength++;
        }

        prevIndex = currentIndex;
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
