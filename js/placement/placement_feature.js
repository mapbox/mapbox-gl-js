'use strict';

var bboxify = require('bboxify-labels');

module.exports = PlacementFeature;

function PlacementFeature(geometry, anchor, length, height, alignWithLine) {

    if (alignWithLine) {

        var geom = geometry.map(function(d) {
            return [d.x, d.y];
        });

        anchor = {
            index: anchor.segment,
            point: [anchor.x, anchor.y]
        };

        this.boxes = bboxify.bboxifyLabel(geom, anchor, length);

        for (var i = 0; i < this.boxes.length; i++) {
            var b = this.boxes[i];
            b.maxScale = (length / 2 + height) / Math.abs(b.distanceToAnchor);
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
            x1: -length / 2,
            x2: length / 2,
            y1: -height / 2,
            y2: height / 2
        }];
    }
}
