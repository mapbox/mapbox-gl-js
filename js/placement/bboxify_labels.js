'use strict';

var LabelBox = require('./label_box');
var Point = require('point-geometry');

module.exports = {
    bboxifyLabel: bboxifyLabel,
    getCumulativeDistances: getCumulativeDistances,
    line2polyline: line2polyline,
    polyline2xy: polyline2xy
};

function line2polyline(cumulativeDistances, lineDistance) {
    // Determine when the line distance exceeds the cumulative distance
    var segmentIndex = 1;
    while (cumulativeDistances[segmentIndex] < lineDistance) segmentIndex++;

    segmentIndex = Math.min(segmentIndex - 1, cumulativeDistances.length - 2);

    var segmentDistance = lineDistance - cumulativeDistances[segmentIndex];

    return {
        segment: segmentIndex,
        distance: segmentDistance
    };
}

function polyline2xy(points, polylinePoint) {
    var p0 = points[polylinePoint.segment];
    var p1 = points[polylinePoint.segment + 1];

    var x0 = p0.x, y0 = p0.y;
    var x1 = p1.x, y1 = p1.y;

    var direction = x1 > x0 ? 1 : -1;

    var m = (y1 - y0) / (x1 - x0);

    var dx = direction * Math.sqrt(polylinePoint.distance * polylinePoint.distance / (1 + m * m));
    var x = x0 + dx;

        var dy = isFinite(m) ? m * (x - x0) : polylinePoint.distance;
        var y = y0 + dy;

    return new Point(x, y);
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

        // Convert to polyline reference frame
        var polylineCoordinate = line2polyline(cumulativeDistances, lineCoordinate);

        // Convert to canvas reference frame
        var p = polyline2xy(polyline, polylineCoordinate, step);

        var distanceToAnchor = Math.abs(lineCoordinate - anchorLineCoordinate);
        var distanceToInnerEdge = Math.max(distanceToAnchor - step / 2, 0);
        var maxScale = labelLength / 2 / distanceToInnerEdge;

        bboxes.push(new LabelBox(p, -size / 2, -size / 2, size / 2, size / 2, maxScale));
    }

    return bboxes;
}
