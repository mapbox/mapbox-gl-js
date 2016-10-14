'use strict';

const test = require('mapbox-gl-js-test').test;
const mergeLines = require('../../../js/symbol/mergelines');
const Point = require('point-geometry');

function testLines(coords) {
    const lines = [];
    for (let i = 0; i < coords.length; i++) {
        const points = [];
        for (let j = 0; j < coords[i].length; j++) {
            points.push(new Point(coords[i][j], 0));
        }
        lines.push([points]);
    }
    return lines;
}

function merge(lines, letters) {
    const features = new Array(lines.length);
    letters = letters || `${features.join('a')}a`;
    return mergeLines(features, letters.split(''), lines).geometries.filter((a) => { return a !== null; });
}


test('mergeLines merges lines with the same text', (t) => {
    t.deepEqual(
        merge(testLines([[0, 1, 2], [4, 5, 6], [8, 9], [2, 3, 4], [6, 7, 8], [5, 6]]), 'abaaaa'),
        testLines([[0, 1, 2, 3, 4], [4, 5, 6], [5, 6, 7, 8, 9]]));
    t.end();
});

test('mergeLines handles merge from both ends', (t) => {
    t.deepEqual(
        merge(testLines([[0, 1, 2], [4, 5, 6], [2, 3, 4]])),
        testLines([[0, 1, 2, 3, 4, 5, 6]]));
    t.end();
});

test('mergeLines handles circular lines', (t) => {
    t.deepEqual(
        merge(testLines([[0, 1, 2], [2, 3, 4], [4, 0]])),
        testLines([[0, 1, 2, 3, 4, 0]]));
    t.end();
});
