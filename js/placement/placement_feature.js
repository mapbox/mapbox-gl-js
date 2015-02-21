'use strict';

var bboxify = require('bboxify-labels');

module.exports = PlacementFeature;

function PlacementFeature(geometry, anchor, left, right, top, bottom, alignWithLine) {

    if (alignWithLine) {

        var height = bottom - top;
        var length = right - left;

        this.boxes = bboxify.bboxifyLabel(geometry, anchor, length, height);

        for (var i = 0; i < this.boxes.length; i++) {
            var b = this.boxes[i];
            b.maxScale = (length / 2 + height * 0.3) / Math.abs(b.distanceToAnchor);
            b.x1 = -b.width / 2;
            b.x2 = b.width / 2;
            b.y1 = -b.height / 2;
            b.y2 = b.height / 2;

        }


    } else {
        this.boxes = [{
            x: anchor.x,
            y: anchor.y,
            maxScale: Infinity,
            x1: left,
            x2: right,
            y1: top,
            y2: bottom
        }];
    }
}
