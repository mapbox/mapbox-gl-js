// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {test, expect} from '../../util/vitest';
import emptyStyle from '../../../src/style-spec/empty';
import {validateStyle} from '../../../src/style-spec/validate_style.min';

test('it generates something', () => {
    const style = emptyStyle();
    expect(style).toBeTruthy();
});

test('generated empty style is a valid style', () => {
    const errors = validateStyle(emptyStyle());
    expect(errors.length).toEqual(0);
});
