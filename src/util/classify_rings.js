'use strict';

const quickselect = require('quickselect');
const calculateSignedArea = require('./util').calculateSignedArea;

// classifies an array of rings into polygons with outer rings and holes
module.exports = function classifyRings(rings, maxRings) {
    const len = rings.length;

    if (len <= 1) return [rings];

    const polygons = [];
    let polygon,
        ccw;

    for (let i = 0; i < len; i++) {
        const area = calculateSignedArea(rings[i]);
        if (area === 0) continue;

        rings[i].area = Math.abs(area);

        if (ccw === undefined) ccw = area < 0;

        if (ccw === area < 0) {
            if (polygon) polygons.push(polygon);
            polygon = [rings[i]];

        } else {
            polygon.push(rings[i]);
        }
    }
    if (polygon) polygons.push(polygon);

    // Earcut performance degrages with the # of rings in a polygon. For this
    // reason, we limit strip out all but the `maxRings` largest rings.
    if (maxRings > 1) {
        for (let j = 0; j < polygons.length; j++) {
            if (polygons[j].length <= maxRings) continue;
            quickselect(polygons[j], maxRings, 1, polygons[j].length - 1, compareAreas);
            polygons[j] = polygons[j].slice(0, maxRings);
        }
    }

    return polygons;
};

function compareAreas(a, b) {
    return b.area - a.area;
}
