'use strict';

var CollisionBox = require('./collision_box');

module.exports = CollisionFeature;

function CollisionFeature(line, anchor, shaped, boxScale, padding, alignLine) {

    var y1 = shaped.top * boxScale - padding;
    var y2 = shaped.bottom * boxScale + padding;
    var x1 = shaped.left * boxScale - padding;
    var x2 = shaped.right * boxScale + padding;

    this.boxes = [];

    if (alignLine) {

        var height = y2 - y1;
        var length = x2 - x1;

        if (height <= 0) return;

        // set minimum box height to avoid very many small labels
        height = Math.max(10 * boxScale, height);

        this.bboxifyLabel(line, anchor, length, height);

    } else {
        this.boxes.push(new CollisionBox(anchor, x1, y1, x2, y2, Infinity));
    }
}

CollisionFeature.prototype.bboxifyLabel = function(line, anchor, labelLength, boxSize) {
    var step = boxSize / 2;
    var nBoxes = Math.floor(labelLength / step);

    // offset the center of the first box by half a box so that the edge of the
    // box is at the edge of the label.
    var firstBoxOffset = -boxSize / 2;

    var bboxes = this.boxes;

    var p = anchor;
    var index = anchor.segment + 1;
    var anchorDistance = firstBoxOffset;

    // move backwards along the line to the first segment the label appears on
    do {
        index--;

        // there isn't enough room for the label after the beginning of the line
        // checkMaxAngle should have already caught this
        if (index < 0) return bboxes;

        anchorDistance -= line[index].dist(p);
        p = line[index];
    } while (anchorDistance > -labelLength / 2);

    var segmentLength = line[index].dist(line[index + 1]);

    for (var i = 0; i < nBoxes; i++) {
        // the distance the box will be from the anchor
        var boxDistanceToAnchor = -labelLength / 2 + i * step;

        // the box is not on the current segment. Move to the next segment.
        while (anchorDistance + segmentLength < boxDistanceToAnchor) {
            anchorDistance += segmentLength;
            index++;

            // There isn't enough room before the end of the line.
            if (index + 1 >= line.length) return bboxes;

            segmentLength = line[index].dist(line[index + 1]);
        }

        // the distance the box will be from the beginning of the segment
        var segmentBoxDistance = boxDistanceToAnchor - anchorDistance;

        var p0 = line[index];
        var p1 = line[index + 1];
        var boxAnchor = p1.sub(p0)._unit()._mult(segmentBoxDistance)._add(p0);

        var distanceToInnerEdge = Math.max(Math.abs(boxDistanceToAnchor - firstBoxOffset) - step / 2, 0);
        var maxScale = labelLength / 2 / distanceToInnerEdge;

        bboxes.push(new CollisionBox(boxAnchor, -boxSize / 2, -boxSize / 2, boxSize / 2, boxSize / 2, maxScale));
    }

    return bboxes;
};
