'use strict';

import { test } from 'mapbox-gl-js-test';
import resolveTokens from '../../../src/util/token';

test('resolveToken', (t) => {
    t.equal('3 Fine Fields', resolveTokens({a:3, b:'Fine', c:'Fields'}, '{a} {b} {c}'));

    // No tokens.
    t.equal(resolveTokens({}, 'Test'), 'Test');

    // Basic.
    t.equal(resolveTokens({name: 'Test'}, '{name}'), 'Test');
    t.equal(resolveTokens({name: 'Test'}, '{name}-suffix'), 'Test-suffix');

    // Undefined property.
    t.equal(resolveTokens({}, '{name}'), '');
    t.equal(resolveTokens({}, '{name}-suffix'), '-suffix');

    // Non-latin.
    t.equal(resolveTokens({city: '서울특별시'}, '{city}'), '서울특별시');

    // Unicode up to 65535.
    t.equal(resolveTokens({text: '\ufff0'}, '{text}'), '\ufff0');
    t.equal(resolveTokens({text: '\uffff'}, '{text}'), '\uffff');

    // Non-string values cast to strings.
    t.equal(resolveTokens({name: 5000}, '{name}'), '5000');
    t.equal(resolveTokens({name: -15.5}, '{name}'), '-15.5');
    t.equal(resolveTokens({name: true}, '{name}'), 'true');

    // Non-string values cast to strings, with token replacement.
    t.equal(resolveTokens({name: 5000}, '{name}-suffix'), '5000-suffix');
    t.equal(resolveTokens({name: -15.5}, '{name}-suffix'), '-15.5-suffix');
    t.equal(resolveTokens({name: true}, '{name}-suffix'), 'true-suffix');

    // Special characters in token.
    t.equal(resolveTokens({'dashed-property': 'dashed'}, '{dashed-property}'), 'dashed');
    t.equal(resolveTokens({'HØYDE': 150}, '{HØYDE} m'), '150 m');
    t.equal(resolveTokens({'$special:characters;': 'mapbox'}, '{$special:characters;}'), 'mapbox');

    t.end();
});
