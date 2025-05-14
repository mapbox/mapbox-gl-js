// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {test, expect} from '../../util/vitest';
import mergeLines from '../../../src/symbol/mergelines';
import Point from '@mapbox/point-geometry';

function makeFeatures(lines) {
    const features: Array<any> = [];
    for (const line of lines) {
        const points: Array<any> = [];
        for (let j = 1; j < line.length; j++) {
            points.push(new Point(line[j], 0));
        }
        features.push({text: line[0], geometry: [points]});
    }
    return features;
}

test('mergeLines merges lines with the same text', () => {
    expect(
        mergeLines(makeFeatures([['a', 0, 1, 2], ['b', 4, 5, 6], ['a', 8, 9], ['a', 2, 3, 4], ['a', 6, 7, 8], ['a', 5, 6]]))
    ).toEqual(makeFeatures([['a', 0, 1, 2, 3, 4], ['b', 4, 5, 6], ['a', 5, 6, 7, 8, 9]]));
});

test('mergeLines handles merge from both ends', () => {
    expect(mergeLines(makeFeatures([['a', 0, 1, 2], ['a', 4, 5, 6], ['a', 2, 3, 4]]))).toEqual(makeFeatures([['a', 0, 1, 2, 3, 4, 5, 6]]));
});

test('mergeLines handles circular lines', () => {
    expect(mergeLines(makeFeatures([['a', 0, 1, 2], ['a', 2, 3, 4], ['a', 4, 0]]))).toEqual(makeFeatures([['a', 0, 1, 2, 3, 4, 0]]));
});
