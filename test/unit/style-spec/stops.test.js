import {describe, test, expect} from "../../util/vitest.js";
import {findStopLessThanOrEqualTo} from '../../../src/style-spec/expression/stops.js';

describe('findStopLessThanOrEqualTo', () => {
    test('When the input > all stops it returns the last stop.', () => {
        const index = findStopLessThanOrEqualTo([0, 1, 2, 3, 4, 5, 6, 7], 8);
        expect(index).toEqual(7);
    });

    test('When more than one stop has the same value it always returns the last stop', () => {
        let index;

        index = findStopLessThanOrEqualTo([0.5, 0.5], 0.5);
        expect(index).toEqual(1);

        index = findStopLessThanOrEqualTo([0.5, 0.5, 0.5], 0.5);
        expect(index).toEqual(2);

        index = findStopLessThanOrEqualTo([0.4, 0.5, 0.5, 0.6, 0.7], 0.5);
        expect(index).toEqual(2);
    });
});
