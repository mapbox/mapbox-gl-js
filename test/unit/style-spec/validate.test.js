import {describe, test, expect} from '../../util/vitest.js';
import validate from '../../../src/style-spec/validate_style.js';
import reference from '../../../src/style-spec/reference/latest.js';

// eslint-disable-next-line import/no-unresolved
import {fixtures} from 'virtual:style-spec/fixtures';
import badColorStyleSpecFixture from './fixture/bad-color.input.json';

describe('Validate style', () => {
    Object.keys(fixtures).forEach(fixtureName => {
        test(fixtureName, () => {
            const result = validate(fixtures[fixtureName]);
            for (const error of result) {
                if (error.error) error.error = {};
            }
            expect(JSON.stringify(result, null, 2)).toMatchFileSnapshot(`./fixture/${fixtureName}.output.json`);
        });
    });
});

test('errors from validate do not contain line numbers', () => {
    const style = badColorStyleSpecFixture;
    const result = validate(style, reference);
    expect(result[0].line).toEqual(undefined);
});
