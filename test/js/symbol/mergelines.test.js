'use strict';

var test = require('tape').test,
    mergeLines = require('../../../js/symbol/mergelines.js'),
    Point = require('point-geometry');

function testLines(coords) {
    var lines = [];
    for (var i = 0; i < coords.length; i++) {
        var points = [];
        for (var j = coords[i][0]; j <= coords[i][1]; j++) {
            points.push(new Point(j, 0));
        }
        lines.push([points]);
    }
    return lines;
}

function merge(lines, letters) {
    var features = new Array(lines.length);
    return mergeLines(features, letters.split(''), lines).geometries;
}


test('mergeLines', function(t) {

    t.test('merges lines with the same text', function(t) {
        t.deepEqual(
            merge(testLines([[0,2],[4,6],[8,9],[2,4],[6,8]]), 'abaaa'),
            testLines([[0,4],[4,6],[6,9]]));
        t.end();
    });

});
