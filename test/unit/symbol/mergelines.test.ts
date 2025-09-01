// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {test, expect} from '../../util/vitest';
import mergeLines from '../../../src/symbol/mergelines';
import Point from '@mapbox/point-geometry';

function makeFeatures(lines) {
    const features: Array<any> = [];
    for (const line of lines) {
        const points: Array<any> = [];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        for (let j = 1; j < line.length; j++) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
            points.push(new Point(line[j], 0));
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        features.push({text: line[0], geometry: [points]});
    }
    return features;
}

test('mergeLines merges lines with the same text', () => {
    expect(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        mergeLines(makeFeatures([['a', 0, 1, 2], ['b', 4, 5, 6], ['a', 8, 9], ['a', 2, 3, 4], ['a', 6, 7, 8], ['a', 5, 6]]))
    ).toEqual(makeFeatures([['a', 0, 1, 2, 3, 4], ['b', 4, 5, 6], ['a', 5, 6, 7, 8, 9]]));
});

test('mergeLines handles merge from both ends', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    expect(mergeLines(makeFeatures([['a', 0, 1, 2], ['a', 4, 5, 6], ['a', 2, 3, 4]]))).toEqual(makeFeatures([['a', 0, 1, 2, 3, 4, 5, 6]]));
});

test('mergeLines handles circular lines', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    expect(mergeLines(makeFeatures([['a', 0, 1, 2], ['a', 2, 3, 4], ['a', 4, 0]]))).toEqual(makeFeatures([['a', 0, 1, 2, 3, 4, 0]]));
});
