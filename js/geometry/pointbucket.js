'use strict';

var ElementGroups = require('./elementgroups.js');
var interpolate = require('./interpolate.js');
var resolveTokens = require('../util/token.js');
if (typeof self !== 'undefined') var actor = require('../worker/worker.js');

module.exports = PointBucket;

function PointBucket(info, buffers, placement, elementGroups) {
    this.info = info;
    this.buffers = buffers;
    this.placement = placement;
    this.elementGroups = elementGroups || new ElementGroups(buffers.pointVertex);
}

PointBucket.prototype.addFeatures = function() {
    var features = this.features;
    for (var i = 0; i < features.length; i++) {
        var feature = features[i];
        this.addFeature(feature);
    }
};

PointBucket.prototype.addFeature = function(feature) {

    var info = this.info;
    var imagePos = false;
    if (info['icon-image'] && this.sprite) {
        imagePos = this.sprite[resolveTokens(feature.properties, info['icon-image'])];
        imagePos = imagePos && {
            tl: [ imagePos.x, imagePos.y ],
            br: [ imagePos.x + imagePos.width, imagePos.y + imagePos.height ]
        };
    }

    var lines = feature.loadGeometry();

    var size = this.info['icon-size'];
    var spacing = this.info['icon-spacing'];
    var padding = this.info['icon-padding'];

    for (var i = 0; i < lines.length; i++) {

        var points = lines[i];
        if (spacing) points = interpolate(points, spacing, 1, 1);

        if (size) {
            var ratio = 8, // todo uhardcode tileExtent/tileSize
                x = size / 2 * ratio,
                y = size / 2 * ratio;

            for (var k = 0; k < points.length; k++) {
                var point = points[k];

                var glyphs = [{
                    box: { x1: -x, x2: x, y1: -y, y2: y },
                    minScale: 1,
                    anchor: point
                }];

                var placement = this.placement.collision.place(
                        glyphs, point, 1, 16, padding, false,
                        info['icon-allow-overlap'], info['icon-ignore-placement']);

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

PointBucket.prototype.getDependencies = function(tile, callback) {
    var bucket = this;
    if (this.info['icon-image']) {
        actor.send('get sprite json', {}, function(err, sprite) {
            bucket.sprite = sprite;
            callback(err);
        });
    } else {
        setTimeout(callback, 0);
    }
};
