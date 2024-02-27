import {describe, test, expect} from '../../util/vitest.js';
import validateMapboxApiSupported from '../../../src/style-spec/validate_mapbox_api_supported.js';
import reference from '../../../src/style-spec/reference/latest.js';

// eslint-disable-next-line import/no-unresolved
import {fixtures} from 'virtual:style-spec/fixtures';
import badColorStyleSpecFixture from './fixture/bad-color.input.json';

describe('Validate style', () => {
    Object.keys(fixtures).forEach(fixtureName => {
        test(fixtureName, () => {
            const result = validateMapboxApiSupported(fixtures[fixtureName]);
            for (const error of result) {
                if (error.error) error.error = {};
            }
            expect(JSON.stringify(result, null, 2)).toMatchFileSnapshot(`./fixture/${fixtureName}.output-api-supported.json`);
        });
    });
});

test('errors from validate do not contain line numbers', () => {
    const style = badColorStyleSpecFixture;
    const result = validateMapboxApiSupported(style, reference);
    expect(result[0].line).toEqual(undefined);
});

test('duplicate imports ids', () => {
    window.Buffer = class {};
    const style = badColorStyleSpecFixture;
    const result = validateMapboxApiSupported(
        {
            ...style,
            imports: [
                {id: 'standard', url: 'mapbox://styles/mapbox/standard'},
                {id: 'standard', url: 'mapbox://styles/mapbox/standard-2'},
            ],
        },
        reference
    );
    expect(result[3].message).toEqual('Duplicate ids of imports');
});
