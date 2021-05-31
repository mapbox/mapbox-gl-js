// @flow

import {test} from '../../util/test.js';
import fs from 'fs';
import path from 'path';
import window from '../../../src/util/window.js';
import {RequestManager} from '../../../src/util/mapbox.js';
import loadGlyphRange from '../../../src/style/load_glyph_range.js';

import {fileURLToPath} from 'url';
// $FlowFixMe https://github.com/facebook/flow/issues/6913
const __dirname = fileURLToPath(new URL('.', import/*:: ("")*/.meta.url));

test('loadGlyphRange', (t) => {
    window.useFakeXMLHttpRequest();

    t.tearDown(() => {
        window.restore();
    });

    const transform = t.stub().callsFake((url) => ({url}));
    const manager = new RequestManager(transform);

    let request;
    window.XMLHttpRequest.onCreate = (req) => { request = req; };

    loadGlyphRange('Arial Unicode MS', 0, 'https://localhost/fonts/v1/{fontstack}/{range}.pbf', manager, (err, result) => {
        t.ifError(err);
        t.ok(transform.calledOnce);
        t.deepEqual(transform.getCall(0).args, ['https://localhost/fonts/v1/Arial Unicode MS/0-255.pbf', 'Glyphs']);

        if (!result) return t.fail(); // appease flow
        t.equal(typeof result.ascender, 'undefined');
        t.equal(typeof result.descender, 'undefined');
        t.equal(result.ascender, undefined);
        t.equal(result.descender, undefined);
        t.equal(Object.keys(result.glyphs).length, 223);
        for (const key in result.glyphs) {
            const id = Number(key);
            const glyph = result.glyphs[id];
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
    // $FlowFixMe https://github.com/facebook/flow/pull/8465
    request.response = fs.readFileSync(path.join(__dirname, '../../fixtures/0-255.pbf'));
    request.onload();

});
