'use strict';

var CollisionBox = require('./collision_box');

module.exports = CollisionFeature;

function CollisionFeature(geometry, anchor, shaped, boxScale, padding, alignLine) {

    var top = shaped.top * boxScale - padding;
    var bottom = shaped.bottom * boxScale + padding;
    var left = shaped.left * boxScale - padding;
    var right = shaped.right * boxScale + padding;

    if (alignLine) {

        var height = bottom - top;
        var length = right - left;

        this.boxes = bboxifyLabel(geometry, anchor, length, height);

    } else {
        this.boxes = [new CollisionBox(anchor, left, top, right, bottom, Infinity)];
    }
}

function bboxifyLabel(line, anchor, labelLength, boxSize) {
    // Determine the bounding boxes needed to cover the label in the
    // neighborhood of the anchor.

    var step = boxSize / 2;

    var cumulativeDistances = getCumulativeDistances(line);
    var anchorSegmentDistance = anchor.dist(line[anchor.segment]);
    var anchorLineCoordinate = cumulativeDistances[anchor.segment] + anchorSegmentDistance;

    // Determine where the 1st and last bounding boxes
    // lie on the line reference frame
    var labelStartLineCoordinate = anchorLineCoordinate - 0.5 * labelLength;

    // offset the center of the first box by half a box
    labelStartLineCoordinate += boxSize / 2;

    var bboxes = [];
    var nBoxes = Math.floor(labelLength / step);
    for (var i = 0; i < nBoxes; i++) {

        var lineCoordinate = labelStartLineCoordinate + i * step;

        var p = getPointAtDistance(cumulativeDistances, lineCoordinate, line);
        var distanceToAnchor = Math.abs(lineCoordinate - anchorLineCoordinate);
        var distanceToInnerEdge = Math.max(distanceToAnchor - step / 2, 0);
        var maxScale = labelLength / 2 / distanceToInnerEdge;

        bboxes.push(new CollisionBox(p, -boxSize / 2, -boxSize / 2, boxSize / 2, boxSize / 2, maxScale));
    }

    return bboxes;
}

function getPointAtDistance(cumulativeDistances, lineDistance, points) {
    // Determine when the line distance exceeds the cumulative distance
    var segmentIndex = 1;
    while (cumulativeDistances[segmentIndex] < lineDistance) segmentIndex++;

    segmentIndex = Math.min(segmentIndex - 1, cumulativeDistances.length - 2);

    // handle duplicate points
    while (points[segmentIndex].equals(points[segmentIndex + 1])) segmentIndex--;

    var segmentDistance = lineDistance - cumulativeDistances[segmentIndex];

    var p0 = points[segmentIndex];
    var p1 = points[segmentIndex + 1];
    return p1.sub(p0)._unit()._mult(segmentDistance)._add(p0);
}

function getCumulativeDistances(points) {
    var distances = [0];
    for (var i = 1, dist = 0; i < points.length; i++) {
        dist += points[i].dist(points[i - 1]);
        distances.push(dist);
    }
    return distances;
}
