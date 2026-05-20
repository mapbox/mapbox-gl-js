// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect} from '../../util/vitest';
import validate from '../../../src/style-spec/validate_style';
import reference from '../../../src/style-spec/reference/latest';
import {fixtures} from 'virtual:style-spec/fixtures';
import badColorStyleSpecFixture from './fixture/bad-color.input.json';

describe('Validate style', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    Object.keys(fixtures).forEach(fixtureName => {
        test(fixtureName, async () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
            const result = validate(fixtures[fixtureName]);
            for (const error of result) {
                if (error.error) error.error = {};
            }
            const snapshot = `./fixture/${fixtureName}.output.json`;
            await expect(JSON.stringify(result, null, 2)).toMatchFileSnapshot(snapshot, snapshot);
        });
    });
});

test('errors from validate do not contain line numbers', () => {
    const style = badColorStyleSpecFixture;
    const result = validate(style, reference);
    expect(result[0].line).toEqual(undefined);
});

test('validate accepts a UTF-8 encoded Uint8Array', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    const bytes = new TextEncoder().encode(fixtures['bad-color']);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    expect(JSON.stringify(validate(bytes))).toEqual(JSON.stringify(validate(fixtures['bad-color'])));
});
