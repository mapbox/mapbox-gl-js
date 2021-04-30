
import {test} from '../../util/test.js';
import EasedVariable from '../../../src/util/eased_variable.js';

test('EasedVariable', (t) => {
    const v = new EasedVariable(0);

    t.equal(v.isEasing(0), false);
    t.equal(v.getValue(0), 0);

    v.jumpTo(10);

    t.equal(v.isEasing(1), false);
    t.equal(v.getValue(0), 10);
    t.equal(v.getValue(1), 10);
    t.equal(v.getValue(2), 10);

    v.easeTo(20, 1, 2);

    t.equal(v.isEasing(0), false);
    t.equal(v.isEasing(1), true);
    t.equal(v.isEasing(2), true);
    t.equal(v.isEasing(3), true);
    t.equal(v.isEasing(4), false);

    t.equal(v.getValue(0), 10);
    t.equal(v.getValue(1), 10);
    t.equal(v.getValue(2), 15);
    t.equal(v.getValue(3), 20);
    t.equal(v.getValue(4), 20);

    // Start another ease in the middle of the previous
    v.easeTo(20, 2, 2);
    t.equal(v.getValue(1), 15);
    t.equal(v.getValue(2), 15);
    t.equal(v.getValue(3), 17.5);
    t.equal(v.getValue(4), 20);
    t.equal(v.getValue(5), 20);

    t.end();
});
