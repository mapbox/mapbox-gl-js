import {test} from '../../util/test';
import {cacheGet, cachePut, cacheOpen, cacheClose} from '../../../src/util/local_glyph_cache';
import window from '../../../src/util/window';
import sinon from 'sinon';

const FONT_FAMILY_NAME = "sans-serif";
const FONT_NAME = "fontname";

test('local_glyph_cache', (t) => {
    t.beforeEach(callback => {
        cacheClose();
        window.indexedDB = sinon.stub();
        callback();
    });

    t.afterEach(callback => {
        window.restore();
        callback();
    });

    t.test('cachePut, no window.indexedDB', (t) => {
        delete window.indexedDB;
        cacheOpen(FONT_FAMILY_NAME);

        let result;
        try {
            result = cachePut(FONT_NAME, {});
            t.pass('should return successfully');
            t.notOk(result, 'should return null');
        } catch (e) {
            t.ifError(e, 'should not result in error');
        }
        t.end();
    });

    t.test('cacheGet, no window.indexedDB', (t) => {
        delete window.indexedDB;
        cacheOpen(FONT_FAMILY_NAME);

        cacheGet(FONT_NAME, 0, (result) => {
            t.ifError(result, 'should not result in error');
            t.equals(result, null, 'should return null');
            t.end();
        });
    });

    t.test('cacheGet, cache not opened', (t) => {
        cacheGet(FONT_NAME, 0, (result) => {
            t.ifError(result, 'should not result in error');
            t.equals(result, null, 'should return null');
            t.end();
        });
    });

    t.test('cacheGet, unknown key', (t) => {
        delete window.indexedDB;
        cacheOpen(FONT_FAMILY_NAME);

        cacheGet(FONT_NAME, 0, (result) => {
            t.ifError(result, 'should not result in error');
            t.equals(result, null, 'should return null');
            t.end();
        });
    });

    t.test('cachePut, cache not opened', (t) => {
        let result;
        try {
            result = cachePut(FONT_NAME, {});
            t.pass('should return successfully');
            t.notOk(result, 'should return null');
        } catch (e) {
            t.ifError(e, 'should not result in error');
        }
        t.end();
    });

    t.end();
});
