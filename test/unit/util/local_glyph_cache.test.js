import {test} from '../../util/test';
import LocalGlyphCache from '../../../src/util/local_glyph_cache';
import window from '../../../src/util/window';
import sinon from 'sinon';

const FONT_FAMILY_NAME = "sans-serif";
const FONT_WEIGHT = "500";

test('local_glyph_cache', (t) => {
    t.beforeEach(callback => {
        window.indexedDB = sinon.stub();
        callback();
    });

    t.afterEach(callback => {
        window.restore();
        callback();
    });

    t.test('cache.put, no window.indexedDB', (t) => {
        delete window.indexedDB;
        const cache = new LocalGlyphCache(FONT_FAMILY_NAME);

        let result;
        try {
            result = cache.put(FONT_WEIGHT, {});
            t.pass('should return successfully');
            t.notOk(result, 'should return null');
        } catch (e) {
            t.ifError(e, 'should not result in error');
        }
        t.end();
    });

    t.test('cache.get, no window.indexedDB', (t) => {
        delete window.indexedDB;
        const cache = new LocalGlyphCache(FONT_FAMILY_NAME);

        cache.get(FONT_WEIGHT, 0, (result) => {
            t.ifError(result, 'should not result in error');
            t.equals(result, null, 'should return null');
            t.end();
        });
    });

    t.end();
});
