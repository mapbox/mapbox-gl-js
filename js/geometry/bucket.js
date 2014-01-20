'use strict';

module.exports = Bucket;

function Bucket(info, geometry) {

    this.info = info;
    this.geometry = geometry;

    this.indices = {
        lineVertexIndex: geometry.lineVertex.index,

        fillBufferIndex: geometry.fillBufferIndex,
        fillVertexIndex: geometry.fillVertex.index,
        fillElementsIndex: geometry.fillElements.index,

        glyphVertexIndex: geometry.glyphVertex.index
    };

    if (info.text === true) {
        throw('todo');
    } else if (info.type == 'point' && info.marker) {
        this.addFeature = this.addMarkers;
        this.spacing = info.spacing || 100;

    } else if (info.type == 'line') {
        this.addFeature = this.addLine;
    } else if (info.type == 'fill') {
        this.addFeature = this.addFill;
    } else if (info.type == 'point') {
        this.addFeature = this.addPoint;
    } else {
        throw('unrecognized type');
    }
}

Bucket.prototype.toJSON = function() {
    return this.indices;
};

Bucket.prototype.end = function() {
    var geometry = this.geometry;
    var indices = this.indices;

    indices.lineVertexIndexEnd = geometry.lineVertex.index;

    indices.fillBufferIndexEnd = geometry.fillBufferIndex;
    indices.fillVertexIndexEnd = geometry.fillVertex.index;
    indices.fillElementsIndexEnd = geometry.fillElements.index;

    indices.glyphVertexIndexEnd = geometry.glyphVertex.index;
};


Bucket.prototype.addMarkers = function(lines) {
    for (var i = 0; i < lines.length; i++) {
        this.geometry.addMarkers(lines[i], this.spacing);
    }
};

Bucket.prototype.addLine = function(lines) {
    var info = this.info;
    for (var i = 0; i < lines.length; i++) {
        this.geometry.addLine(lines[i], info.join, info.cap, info.miterLimit, info.roundLimit);
    }
};

Bucket.prototype.addFill = function(lines) {
    for (var i = 0; i < lines.length; i++) {
        this.geometry.addFill(lines[i]);
    }
};

Bucket.prototype.addPoint = function(lines) {
    for (var i = 0; i < lines.length; i++) {
        this.geometry.addLine(lines[i]);
    }
};
