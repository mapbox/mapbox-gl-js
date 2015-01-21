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
    var fillVertex = this.buffers.fillVertex,
        fillElement = this.buffers.fillElement,
        outlineElement = this.buffers.outlineElement;

    var start = self.performance.now();
    self.tesselateTime = self.tesselateTime || 0;

    var geometries = [];
    var currentIndex;
    var prevIndex;
    var elementGroup;

    // add outlines
    for (var k = this.features.length - 1; k >= 0; k--) {
        var lines = geometries[k] = this.features[k].loadGeometry();
        for (var l = 0; l < lines.length; l++) {
            var line = lines[l];
            elementGroup = this.elementGroups.makeRoomFor(line.length);

            for (var v = 0; v < line.length; v++) {
                var vertex = line[v];

                currentIndex = fillVertex.index - elementGroup.vertexStartIndex;
                fillVertex.add(vertex.x, vertex.y);
                elementGroup.vertexLength++;

                if (v >= 1) {
                    outlineElement.add(prevIndex, currentIndex);
                    elementGroup.secondElementLength++;
                }

                prevIndex = currentIndex;
            }
        }
    }

    // add fills
    for (var i = this.features.length - 1; i >= 0; i--) {
        var rings = geometries[i];
        var polygons = classifyRings(convertCoords(rings));

        for (var j = 0; j < polygons.length; j++) {
            var triangles = earcut(polygons[j]);
            elementGroup = this.elementGroups.makeRoomFor(triangles.length);

            for (var m = 0; m < triangles.length; m++) {
                var index = fillVertex.index - elementGroup.vertexStartIndex;
                fillVertex.add(triangles[m][0], triangles[m][1]);
                fillElement.add(index);
                elementGroup.elementLength++;
                elementGroup.vertexLength++;
            }
        }
    }

    self.tesselateTime += self.performance.now() - start;
};

FillBucket.prototype.hasData = function() {
    return !!this.elementGroups.current;
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
