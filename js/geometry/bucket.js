'use strict';

module.exports = Bucket;

var interpolate = require('./interpolate.js'),
    bucketFilter = require('../style/bucket-filter.js');

function Bucket(info, geometry, placement, indices) {

    this.info = info;
    this.geometry = geometry;
    this.placement = placement;
    this.indices = indices; // only used after transfer from worker

    if (info.text) {
        this.addFeature = this.addText;

    } else if (info.point) {
        this.addFeature = this.addPoint;
        this.size = info['point-size'];
        this.spacing = info['point-spacing'];
        this.padding = info['point-padding'] || 2;

    } else if (info.line) {
        this.addFeature = this.addLine;

    } else if (info.fill) {
        this.addFeature = this.addFill;

    } else {
        console.warn('No type specified');
    }

    this.compare = bucketFilter(this, ['source', 'feature_type']);
}

Bucket.prototype.start = function() {
    var geometry = this.geometry;

    this.indices = {
        lineBufferIndex: geometry.lineBufferIndex,
        lineVertexIndex: geometry.lineVertex.index,
        lineElementIndex: geometry.lineElement.index,

        fillBufferIndex: geometry.fillBufferIndex,
        fillVertexIndex: geometry.fillVertex.index,
        fillElementsIndex: geometry.fillElements.index,

        glyphVertexIndex: geometry.glyphVertex.index,

        pointVertexIndex: geometry.pointVertex.index
    };
};


Bucket.prototype.end = function() {
    var geometry = this.geometry;
    var indices = this.indices;

    indices.lineBufferIndexEnd = geometry.lineBufferIndex;
    indices.lineVertexIndexEnd = geometry.lineVertex.index;
    indices.lineElementIndexEnd = geometry.lineElement.index;

    indices.fillBufferIndexEnd = geometry.fillBufferIndex;
    indices.fillVertexIndexEnd = geometry.fillVertex.index;
    indices.fillElementsIndexEnd = geometry.fillElements.index;

    indices.glyphVertexIndexEnd = geometry.glyphVertex.index;

    indices.pointVertexIndexEnd = geometry.pointVertex.index;
};


Bucket.prototype.toJSON = function() {
    return {
        indices: this.indices
    };
};

Bucket.prototype.addLine = function(lines) {
    var info = this.info;
    for (var i = 0; i < lines.length; i++) {
        this.geometry.addLine(lines[i], info['line-join'], info['line-cap'],
                info['line-miter-limit'], info['line-round-limit']);
    }
};

Bucket.prototype.addFill = function(lines) {
    for (var i = 0; i < lines.length; i++) {
        this.geometry.addFill(lines[i]);
    }
};

Bucket.prototype.addPoint = function(lines) {
    for (var i = 0; i < lines.length; i++) {

        var points = lines[i];
        if (this.spacing) points = interpolate(points, this.spacing, 1, 1);

        if (this.size) {
            var ratio = 8, // todo uhardcode tileExtent/tileSize
                x = this.size[0] / 2 * ratio,
                y = this.size[1] / 2 * ratio;

            for (var k = 0; k < points.length; k++) {
                var point = points[k];

                var glyphs = [{
                    box: { x1: -x, x2: x, y1: -y, y2: y },
                    minScale: 1,
                    anchor: point
                }];

                var placement = this.placement.collision.place(glyphs, point, 1, 16, this.padding);
                if (placement) {
                    this.geometry.addPoints([point], placement);
                }
            }

        } else {
            this.geometry.addPoints(points);
        }
    }
};

Bucket.prototype.addText = function(lines, faces, shaping) {
    for (var i = 0; i < lines.length; i++) {
        this.placement.addFeature(lines[i], this.info, faces, shaping);
    }
};
