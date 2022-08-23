import {test} from '../../util/test.js';
import {cacheGet, cachePut, cacheClose} from '../../../src/util/tile_request_cache.js';
import window from '../../../src/util/window.js';
/*eslint-disable import/no-named-as-default-member */
import sinon from 'sinon';

test('tile_request_cache', (t) => {
    t.beforeEach(() => {
        cacheClose();
        window.caches = sinon.stub();
    });

    t.afterEach(() => {
        window.restore();
    });

    t.test('cachePut, no window.caches', (t) => {
        delete window.caches;

        let result;
        try {
            result = cachePut({url:''});
            t.pass('should return successfully');
            t.notOk(result, 'should return null');
        } catch (e) {
            t.ifError(e, 'should not result in error');
        }
        t.end();
    });

    t.test('cacheGet, no window.caches', (t) => {
        delete window.caches;

        cacheGet({url:''}, (result) => {
            t.ifError(result, 'should not result in error');
            t.equals(result, null, 'should return null');
            t.end();
        });
    });

    t.test('cacheGet, cache open error', (t) => {
        window.caches.open = sinon.stub().rejects(new Error('The operation is insecure'));

        cacheGet({url:''}, (error) => {
            t.ok(error, 'should result in error');
            t.equals(error.message, 'The operation is insecure', 'should give the right error message');
            t.end();
        });
    });

    t.test('cacheGet, cache match error', (t) => {
        const fakeCache = sinon.stub();
        fakeCache.match = sinon.stub().withArgs('someurl').rejects(new Error('ohno'));
        window.caches.open = sinon.stub().resolves(fakeCache);

        cacheGet({url:'someurl'}, (error) => {
            t.ok(error, 'should result in error');
            t.equals(error.message, 'ohno', 'should give the right error message');
            t.end();
        });
    });

    t.test('cacheGet, happy path', (t) => {
        const fakeResponse = {
            headers: {get: sinon.stub()},
            clone: sinon.stub(),
            body: 'yay'
        };
        fakeResponse.headers.get.withArgs('Expires').returns('2300-01-01');
        fakeResponse.headers.get.withArgs('Cache-Control').returns(null);
        fakeResponse.clone.returns(fakeResponse);

        const fakeURL = 'someurl?language="es"&worldview="US"';
        const fakeCache = sinon.stub();
        fakeCache.match = sinon.stub().withArgs(fakeURL).resolves(fakeResponse);
        fakeCache.delete = sinon.stub();
        fakeCache.put = sinon.stub();

        window.caches.open = sinon.stub().resolves(fakeCache);

        // ensure that the language and worldview query parameters are retained but other query parameters aren't
        cacheGet({url: `${fakeURL}&accessToken="foo"`}, (error, response, fresh) => {
            t.ifError(error, 'should not result in error');
            t.ok(fakeCache.match.calledWith(fakeURL), 'should call cache.match with correct url');
            t.ok(fakeCache.delete.calledWith(fakeURL), 'should call cache.delete with correct url');
            t.ok(response, 'should give a response');
            t.equals(response.body, 'yay', 'should give the right response object');
            t.ok(fresh, 'should consider a response with a future expiry date as "fresh"');
            t.ok(fakeCache.put.calledWith(fakeURL, fakeResponse), 'should call cache.put for fresh response');
            t.end();
        });
    });

    t.end();
});
