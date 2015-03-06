'use strict';

var bboxify = require('./bboxify_labels');
var LabelBox = require('./label_box');

module.exports = PlacementFeature;

function PlacementFeature(geometry, anchor, shaped, boxScale, padding, alignLine) {

    var top = shaped.top * boxScale - padding;
    var bottom = shaped.bottom * boxScale + padding;
    var left = shaped.left * boxScale - padding;
    var right = shaped.right * boxScale + padding;

    if (alignLine) {

        var height = bottom - top;
        var length = right - left;

        this.boxes = bboxify.bboxifyLabel(geometry, anchor, length, height);

    } else {
        this.boxes = [new LabelBox(anchor, left, top, right, bottom, Infinity)];
    }
}
