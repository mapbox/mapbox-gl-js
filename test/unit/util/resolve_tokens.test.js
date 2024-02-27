import {test, expect} from "../../util/vitest.js";
import resolveTokens from '../../../src/util/resolve_tokens.js';

test('resolveToken', () => {
    expect('3 Fine Fields').toEqual(resolveTokens({a:3, b:'Fine', c:'Fields'}, '{a} {b} {c}'));

    // No tokens.
    expect(resolveTokens({}, 'Test')).toEqual('Test');

    // Basic.
    expect(resolveTokens({name: 'Test'}, '{name}')).toEqual('Test');
    expect(resolveTokens({name: 'Test'}, '{name}-suffix')).toEqual('Test-suffix');

    // Undefined property.
    expect(resolveTokens({}, '{name}')).toEqual('');
    expect(resolveTokens({}, '{name}-suffix')).toEqual('-suffix');

    // Non-latin.
    expect(resolveTokens({city: '서울특별시'}, '{city}')).toEqual('서울특별시');

    // Unicode up to 65535.
    expect(resolveTokens({text: '\ufff0'}, '{text}')).toEqual('\ufff0');
    expect(resolveTokens({text: '\uffff'}, '{text}')).toEqual('\uffff');

    // Non-string values cast to strings.
    expect(resolveTokens({name: 5000}, '{name}')).toEqual('5000');
    expect(resolveTokens({name: -15.5}, '{name}')).toEqual('-15.5');
    expect(resolveTokens({name: true}, '{name}')).toEqual('true');

    // Non-string values cast to strings, with token replacement.
    expect(resolveTokens({name: 5000}, '{name}-suffix')).toEqual('5000-suffix');
    expect(resolveTokens({name: -15.5}, '{name}-suffix')).toEqual('-15.5-suffix');
    expect(resolveTokens({name: true}, '{name}-suffix')).toEqual('true-suffix');

    // Special characters in token.
    expect(resolveTokens({'dashed-property': 'dashed'}, '{dashed-property}')).toEqual('dashed');
    expect(resolveTokens({'HØYDE': 150}, '{HØYDE} m')).toEqual('150 m');
    expect(
        resolveTokens({'$special:characters;': 'mapbox'}, '{$special:characters;}')
    ).toEqual('mapbox');
});
