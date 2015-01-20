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
        fillElement = this.buffers.fillElement;

    var start = self.performance.now();
    self.tesselateTime = self.tesselateTime || 0;

    for (var i = this.features.length - 1; i >= 0; i--) {
        var rings = this.features[i].loadGeometry();
        var polygons = classifyRings(convertCoords(rings));

        for (var j = 0; j < polygons.length; j++) {
            var triangles = earcut(polygons[j]);
            var elementGroup = this.elementGroups.makeRoomFor(triangles.length);

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
