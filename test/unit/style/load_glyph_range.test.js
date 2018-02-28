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

        t.equal(Object.keys(result).length, 223);
        for (const id in result) {
            t.equal(result[id].id, Number(id));
            t.ok(result[id].metrics);
            t.equal(typeof result[id].metrics.width, 'number');
            t.equal(typeof result[id].metrics.height, 'number');
            t.equal(typeof result[id].metrics.top, 'number');
            t.equal(typeof result[id].metrics.advance, 'number');
        }
        t.end();
    });

    t.equal(request.url, 'https://localhost/fonts/v1/Arial Unicode MS/0-255.pbf');
    request.setStatus(200);
    request.response = fs.readFileSync(path.join(__dirname, '../../fixtures/0-255.pbf'));
    request.onload();

});
