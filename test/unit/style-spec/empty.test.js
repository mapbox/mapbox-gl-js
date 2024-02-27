import {test, expect} from "../../util/vitest.js";
import emptyStyle from '../../../src/style-spec/empty.js';
import {validateStyle} from '../../../src/style-spec/validate_style.min.js';

test('it generates something', () => {
    const style = emptyStyle();
    expect(style).toBeTruthy();
});

test('generated empty style is a valid style', () => {
    const errors = validateStyle(emptyStyle());
    expect(errors.length).toEqual(0);
});
