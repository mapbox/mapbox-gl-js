import {test, expect} from "../../util/vitest.js";
import EasedVariable from '../../../src/util/eased_variable.js';

test('EasedVariable', () => {
    const v = new EasedVariable(0);

    expect(v.isEasing(0)).toEqual(false);
    expect(v.getValue(0)).toEqual(0);

    v.jumpTo(10);

    expect(v.isEasing(1)).toEqual(false);
    expect(v.getValue(0)).toEqual(10);
    expect(v.getValue(1)).toEqual(10);
    expect(v.getValue(2)).toEqual(10);

    v.easeTo(20, 1, 2);

    expect(v.isEasing(0)).toEqual(false);
    expect(v.isEasing(1)).toEqual(true);
    expect(v.isEasing(2)).toEqual(true);
    expect(v.isEasing(3)).toEqual(true);
    expect(v.isEasing(4)).toEqual(false);

    expect(v.getValue(0)).toEqual(10);
    expect(v.getValue(1)).toEqual(10);
    expect(v.getValue(2)).toEqual(15);
    expect(v.getValue(3)).toEqual(20);
    expect(v.getValue(4)).toEqual(20);

    // Start another ease in the middle of the previous
    v.easeTo(20, 2, 2);

    expect(v.getValue(1)).toEqual(15);
    expect(v.getValue(2)).toEqual(15);
    expect(v.getValue(3)).toEqual(17.5);
    expect(v.getValue(4)).toEqual(20);
    expect(v.getValue(5)).toEqual(20);

    // Verify cubic easing
    expect(v.getValue(2.5)).toEqual(15.3125);
    expect(v.getValue(3.5)).toEqual(19.6875);
});
