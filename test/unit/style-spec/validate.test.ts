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

// validate_object iterates the user-supplied object with `for...in` and uses
// each key to index into `elementValidators` / `elementSpecs`. Without
// `Object.hasOwn` guards, a hostile key like "__proto__" matches Object.prototype
// and validateElement is set to Object.prototype itself, then thrown as
// "TypeError: validateElement is not a function" — an uncaught crash on
// load. These tests pin the guards in place.
describe('Validate style prototype-pollution hardening', () => {
    test('does not throw on a source whose id is "__proto__"', () => {
        // JSON.parse is the realistic attack vector; object literals would
        // be treated as prototype setters and never reach the validator.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const style = JSON.parse('{"version":8,"sources":{"__proto__":{"type":"geojson","data":{"type":"FeatureCollection","features":[]}}},"layers":[]}');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        expect(() => validate(style, reference)).not.toThrow();
    });

    test('does not throw on a top-level style key named "__proto__"', () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const style = JSON.parse('{"version":8,"sources":{},"layers":[],"__proto__":"hostile"}');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        expect(() => validate(style, reference)).not.toThrow();
    });

    test('does not throw on a top-level style key named "constructor"', () => {
        // "constructor" inherits to the Object constructor (callable) so the
        // crash mode differs from "__proto__", but the underlying defect is
        // the same: a user-controlled key indexing into a validator map
        // without an own-property check.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const style = JSON.parse('{"version":8,"sources":{},"layers":[],"constructor":"hostile"}');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        expect(() => validate(style, reference)).not.toThrow();
    });
});
