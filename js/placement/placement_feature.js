'use strict';

var bboxify = require('./bboxify_labels');
var LabelBox = require('./label_box');

module.exports = PlacementFeature;

function PlacementFeature(geometry, anchor, left, right, top, bottom, alignWithLine) {

    if (alignWithLine) {

        var height = bottom - top;
        var length = right - left;

        this.boxes = bboxify.bboxifyLabel(geometry, anchor, length, height);

    } else {
        this.boxes = [new LabelBox(anchor, left, top, right, bottom, Infinity)];
    }
}
