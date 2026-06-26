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

test('mergeLines passes MultiLineString features through without merging', () => {
    const multiFeature = {text: 'a', geometry: [
        [new Point(0, 0), new Point(1, 0), new Point(2, 0)],
        [new Point(10, 0), new Point(11, 0), new Point(12, 0)],
    ]};
    // Adjacent single-ring feature whose endpoint matches ring 0 of the MultiLineString
    const bridge = {text: 'a', geometry: [[new Point(2, 0), new Point(3, 0), new Point(4, 0)]]};
    const result = mergeLines([multiFeature, bridge]);
    // MultiLineString is unchanged — both rings preserved, no merge with bridge
    expect(result.length).toBe(2);
    expect(result[0].geometry.length).toBe(2);
    expect(result[0].geometry[0].map((p) => p.x)).toEqual([0, 1, 2]);
    expect(result[0].geometry[1].map((p) => p.x)).toEqual([10, 11, 12]);
    expect(result[1].geometry[0].map((p) => p.x)).toEqual([2, 3, 4]);
});
