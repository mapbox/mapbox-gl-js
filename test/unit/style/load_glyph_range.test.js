// @flow

import { test } from 'mapbox-gl-js-test';
import fs from 'fs';
import path from 'path';
import window from '../../../src/util/window';
import loadGlyphRange from '../../../src/style/load_glyph_range';

test('loadGlyphRange', (t) => {
    window.useFakeXMLHttpRequest();

    t.tearDown(() => {
        window.restore();
    });

    const transform = t.stub().callsFake((url) => ({url}));

    let request;
    window.XMLHttpRequest.onCreate = (req) => { request = req; };

    loadGlyphRange('Arial Unicode MS', 0, 'https://localhost/fonts/v1/{fontstack}/{range}.pbf', transform, (err, result) => {
        t.ifError(err);
        t.ok(transform.calledOnce);
        t.deepEqual(transform.getCall(0).args, ['https://localhost/fonts/v1/Arial Unicode MS/0-255.pbf', 'Glyphs']);

        if (!result) return t.fail(); // appease flow

        t.equal(Object.keys(result).length, 223);
        for (const key in result) {
            const id = Number(key);
            const glyph = result[id];
            if (!glyph) return t.fail(); // appease flow
            t.equal(glyph.id, Number(id));
            t.ok(glyph.metrics);
            t.equal(typeof glyph.metrics.width, 'number');
            t.equal(typeof glyph.metrics.height, 'number');
            t.equal(typeof glyph.metrics.top, 'number');
            t.equal(typeof glyph.metrics.advance, 'number');
        }
        t.end();
    });

    if (!request) return t.fail(); // appease flow

    t.equal(request.url, 'https://localhost/fonts/v1/Arial Unicode MS/0-255.pbf');
    request.setStatus(200);
    request.response = fs.readFileSync(path.join(__dirname, '../../fixtures/0-255.pbf'));
    request.onload();

});
