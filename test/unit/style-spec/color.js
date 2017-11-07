// @flow

'use strict';

const test = require('mapbox-gl-js-test').test;
const Color = require('../../../src/style-spec/util/color');

test('Color.parse', (t) => {
    t.deepEqual(Color.parse('red'), new Color(1, 0, 0, 1));
    t.deepEqual(Color.parse('#ff00ff'), new Color(1, 0, 1, 1));
    t.deepEqual(Color.parse('invalid'), undefined);
    t.deepEqual(Color.parse(null), undefined);
    t.deepEqual(Color.parse(undefined), undefined);
    t.end();
});
