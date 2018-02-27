// @flow

'use strict';

import { test } from 'mapbox-gl-js-test';
import proxyquire from 'proxyquire';

test('loadGlyphRange', (t) => {
    const transform = t.stub().callsFake((url) => ({url}));
    const data = {};
    const getArrayBuffer = t.stub().yields(null, {data});
    const parseGlyphPBF = t.stub().returns([]);

    const loadGlyphRange = proxyquire('../../../src/style/load_glyph_range', {
        '../util/ajax': {getArrayBuffer},
        './parse_glyph_pbf': parseGlyphPBF
    });

    loadGlyphRange('Arial Unicode MS', 0, 'https://localhost/fonts/v1/{fontstack}/{range}.pbf', transform, (err) => {
        t.ifError(err);
        t.ok(transform.calledOnce);
        t.deepEqual(transform.getCall(0).args, ['https://localhost/fonts/v1/Arial Unicode MS/0-255.pbf', 'Glyphs']);
        t.ok(getArrayBuffer.calledOnce);
        t.deepEqual(getArrayBuffer.getCall(0).args[0], {url: 'https://localhost/fonts/v1/Arial Unicode MS/0-255.pbf'});
        t.ok(parseGlyphPBF.calledOnce);
        t.deepEqual(parseGlyphPBF.getCall(0).args, [data]);
        t.end();
    });
});
