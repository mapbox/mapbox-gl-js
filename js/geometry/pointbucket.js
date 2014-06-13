'use strict';

var ElementGroups = require('./elementgroups.js');
var interpolate = require('./interpolate.js');

module.exports = PointBucket;

function PointBucket(info, buffers, placement, elementGroups) {
    this.info = info;
    this.buffers = buffers;
    this.placement = placement;
    this.elementGroups = elementGroups || new ElementGroups(buffers.pointVertex);
}

PointBucket.prototype.addFeature = function(lines, imagePos) {
    var size = this.info['point-size'];
    var spacing = this.info['point-spacing'];
    var padding = this.info['point-padding'] || 2;

    for (var i = 0; i < lines.length; i++) {

        var points = lines[i];
        if (spacing) points = interpolate(points, spacing, 1, 1);

        if (size) {
            var ratio = 8, // todo uhardcode tileExtent/tileSize
                x = size[0] / 2 * ratio,
                  y = size[1] / 2 * ratio;

            for (var k = 0; k < points.length; k++) {
                var point = points[k];

                var glyphs = [{
                    box: { x1: -x, x2: x, y1: -y, y2: y },
                        minScale: 1,
                        anchor: point
                }];

                var placement = this.placement.collision.place(glyphs, point, 1, 16, padding);
                if (placement) {
                    this.addPoints([point], placement, imagePos);
                }
            }

        } else {
            this.addPoints(points, null, imagePos);
        }
    }
};

PointBucket.prototype.addPoints = function(vertices, place, image) {
    var fullRange = [2 * Math.PI, 0];
    image = image || { tl:[0,0], br:[0,0] };

    this.elementGroups.makeRoomFor(0);
    var elementGroup = this.elementGroups.current;

    var pointVertex = this.buffers.pointVertex;

    for (var i = 0; i < vertices.length; i++) {
        var point = vertices[i];

        if (place) {
            pointVertex.add(point.x, point.y, image.tl, image.br, 0, place.zoom, place.rotationRange);
        } else {
            var zoom = point.scale && Math.log(point.scale) / Math.LN2;
            pointVertex.add(point.x, point.y, image.tl, image.br, point.angle || 0, zoom || 0, fullRange);
        }

        elementGroup.vertexLength++;
    }
};


PointBucket.prototype.toJSON = function() {
    return {
        indices: this.elementGroups
    };
};

PointBucket.prototype.start = function() {
};
PointBucket.prototype.end = function() {
};
