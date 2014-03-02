'use strict';

module.exports = Bucket;

function Bucket(info, geometry, placement, indices) {

    this.info = info;
    this.geometry = geometry;
    this.placement = placement;
    this.indices = indices; // only used after transfer from worker

    if (info.type === 'text') {
        this.addFeature = this.addText;

    } else if (info.type == 'point') {
        this.addFeature = this.addPoint;
        this.size = info.size;
        this.spacing = info.spacing;
        this.padding = info.padding || 2;

    } else if (info.type == 'line') {
        this.addFeature = this.addLine;

    } else if (info.type == 'fill') {
        this.addFeature = this.addFill;

    } else {
        console.warn('unrecognized type');
    }

    var compare = info.compare || '==';
    if (compare in comparators) {
        var code = comparators[compare](info);
        if (code) {
            /* jshint evil: true */
            this.compare = new Function('feature', code);
        }
    }

}

Bucket.prototype.start = function() {
    var geometry = this.geometry;

    this.indices = {
        lineVertexIndex: geometry.lineVertex.index,

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

    indices.lineVertexIndexEnd = geometry.lineVertex.index;

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
        this.geometry.addPoints(lines[i], this.placement.collision, this.size, this.padding, this.spacing);
    }
};

Bucket.prototype.addText = function(lines, faces, shaping) {
    for (var i = 0; i < lines.length; i++) {
        this.placement.addFeature(lines[i], this.info, faces, shaping);
    }
};

// Builds a function body from the JSON specification. Allows specifying other compare operations.
var comparators = {
    '==': function(bucket) {
        if (!('field' in bucket)) return;
        var value = bucket.value, field = bucket.field;
        return 'return ' + (Array.isArray(value) ? value : [value]).map(function(value) {
            return 'feature[' + JSON.stringify(field) + '] == ' + JSON.stringify(value);
        }).join(' || ') + ';';
    }
};
