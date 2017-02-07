'use strict';

const test = require('mapbox-gl-js-test').test;
const parseColor = require('../../../src/style-spec/util/parse_color');

test('parseColor', (t) => {
    t.deepEqual(parseColor('red'), [ 1, 0, 0, 1 ]);
    t.deepEqual(parseColor('#ff00ff'), [ 1, 0, 1, 1 ]);
    t.deepEqual(parseColor([ 1, 0, 0, 1 ]), [ 1, 0, 0, 1 ]);
    t.deepEqual(parseColor(null), undefined);
    t.deepEqual(parseColor('#00000'), undefined);
    t.end();
});
