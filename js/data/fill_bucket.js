'use strict';

var ElementGroups = require('./element_groups');
var libtess = require('libtess');
var triangulate = require('../util/triangulate');

var tesselator = initTesselator();

module.exports = FillBucket;

function FillBucket(info, buffers, placement, elementGroups) {
    this.info = info;
    this.buffers = buffers;
    this.elementGroups = elementGroups || new ElementGroups(buffers.fillVertex, buffers.fillElement, buffers.outlineElement);
}

FillBucket.prototype.addFeatures = function() {
    var features = this.features;
    var fillVertex = this.buffers.fillVertex;
    var fillElement = this.buffers.fillElement;
    tesselator.gluTessCallback(libtess.gluEnum.GLU_TESS_VERTEX_DATA, addVertex);

    var n = 0;
    var elementGroups = this.elementGroups;

    var start = self.performance.now();
    self.tesselateTime = self.tesselateTime || 0;

    for (var i = features.length - 1; i >= 0; i--) {
        var feature = features[i];
        var lines = feature.loadGeometry();

        if (lines.length > 1) {
            tesselator.gluTessBeginPolygon();
            for (var k = 0; k < lines.length; k++) {
                var vertices = lines[k];

                tesselator.gluTessBeginContour();
                for (var m = 0; m < vertices.length; m++) {
                    var coords = [vertices[m].x, vertices[m].y, 0];
                    tesselator.gluTessVertex(coords, coords);
                }
                tesselator.gluTessEndContour();
            }
            tesselator.gluTessEndPolygon();
            // console.count('complex');

        } else {
            // console.count('simple');
            var contour = [];
            var vertices = lines[0];
            for (var m = 1; m < vertices.length; m++) {
                contour.push([vertices[m].x, vertices[m].y]);
            }
            if (!contour.length) continue;

            var triangles = triangulate(contour);

            var elementGroup = this.elementGroups.makeRoomFor(m);
            for (var m = 0; m < triangles.length; m++) {
                var index = fillVertex.index - elementGroup.vertexStartIndex;
                fillVertex.add(triangles[m][0], triangles[m][1]);
                fillElement.add(index);
                elementGroup.elementLength++;
            }
        }
    }

    self.tesselateTime += self.performance.now() - start;
    // console.log(Math.round(self.tesselateTime) + ' ms');

    function addVertex(data) {
        if (n % 3 === 0) elementGroups.makeRoomFor(10);
        var index = fillVertex.index - elementGroups.current.vertexStartIndex;
        fillVertex.add(data[0], data[1]);
        fillElement.add(index);
        elementGroups.current.elementLength++;
        n++;
    }
};

FillBucket.prototype.hasData = function() {
    return !!this.elementGroups.current;
};

function initTesselator() {
    var tesselator = new libtess.GluTesselator();
    tesselator.gluTessCallback(libtess.gluEnum.GLU_TESS_COMBINE, function(coords) { return coords; });
    tesselator.gluTessCallback(libtess.gluEnum.GLU_TESS_EDGE_FLAG, function() {});
    tesselator.gluTessNormal(0, 0, 1);
    return tesselator;
}
