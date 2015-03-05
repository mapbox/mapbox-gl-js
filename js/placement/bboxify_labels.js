'use strict';

var LabelBox = require('./label_box');

module.exports = {
    bboxifyLabel: bboxifyLabel,
    getCumulativeDistances: getCumulativeDistances
};

function getPointAtDistance(cumulativeDistances, lineDistance, points) {
    // Determine when the line distance exceeds the cumulative distance
    var segmentIndex = 1;
    while (cumulativeDistances[segmentIndex] < lineDistance) segmentIndex++;

    segmentIndex = Math.min(segmentIndex - 1, cumulativeDistances.length - 2);

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

function bboxifyLabel(polyline, anchor, labelLength, size) {
    var step = size / 2;

    // polyline: array of coordinates [ {x: x0, y: y0}, ..., {x: xn, y: yn} ]
    // anchor: { segment: i, x: x0, y: y0 }
    // labelLength: length of labels in pixel units
    // size: length of the box sides

    // Determine the bounding boxes needed to cover the label in the
    // neighborhood of the anchor.

    // Keep track of segment lengths
    var cumulativeDistances = getCumulativeDistances(polyline);

    var anchorSegmentDistance = anchor.dist(polyline[anchor.segment]);

    var anchorLineCoordinate = cumulativeDistances[anchor.segment] + anchorSegmentDistance;

    // Determine where the 1st and last bounding boxes
    // lie on the line reference frame
    var labelStartLineCoordinate = anchorLineCoordinate - 0.5 * labelLength;

    // offset the center of the first box by half a box
    labelStartLineCoordinate += size / 2;

    var nBoxes = Math.floor(labelLength / step);

    // Create boxes with constant packing
    var bboxes = [];
    for (var i = 0; i < nBoxes; i++) {

        var lineCoordinate = labelStartLineCoordinate + i * step;

        var p = getPointAtDistance(cumulativeDistances, lineCoordinate, polyline);
        var distanceToAnchor = Math.abs(lineCoordinate - anchorLineCoordinate);
        var distanceToInnerEdge = Math.max(distanceToAnchor - step / 2, 0);
        var maxScale = labelLength / 2 / distanceToInnerEdge;

        bboxes.push(new LabelBox(p, -size / 2, -size / 2, size / 2, size / 2, maxScale));
    }

    return bboxes;
}
