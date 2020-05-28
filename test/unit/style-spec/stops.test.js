import {test} from '../../util/test';
import {findStopLessThanOrEqualTo} from '../../../src/style-spec/expression/stops';

test('findStopLessThanOrEqualTo', (t) => {
    test('When the input > all stops it returns the last stop.', (t) => {
        const index = findStopLessThanOrEqualTo([0, 1, 2, 3, 4, 5, 6, 7], 8);
        t.equal(index, 7);
        t.end();
    });

    test('When more than one stop has the same value it always returns the last stop', (t) => {
        let index;

        index = findStopLessThanOrEqualTo([0.5, 0.5], 0.5);
        t.equal(index, 1);

        index = findStopLessThanOrEqualTo([0.5, 0.5, 0.5], 0.5);
        t.equal(index, 2);

        index = findStopLessThanOrEqualTo([0.4, 0.5, 0.5, 0.6, 0.7], 0.5);
        t.equal(index, 2);

        t.end();
    });

    t.end();
});
