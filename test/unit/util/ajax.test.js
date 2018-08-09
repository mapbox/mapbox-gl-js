import { test } from 'mapbox-gl-js-test';
import {
    getArrayBuffer,
    getJSON,
    postData
} from '../../../src/util/ajax';
import window from '../../../src/util/window';

test('ajax', (t) => {
    t.beforeEach(callback => {
        window.useFakeXMLHttpRequest();
        callback();
    });

    t.afterEach(callback => {
        window.restore();
        callback();
    });

    t.test('getArrayBuffer, no content error', (t) => {
        window.server.respondWith(request => {
            request.respond(200, {'Content-Type': 'image/png'}, '');
        });
        getArrayBuffer({ url:'' }, (error) => {
            t.pass('called getArrayBuffer');
            t.ok(error, 'should error when the status is 200 without content.');
            t.end();
        });
        window.server.respond();
    });

    t.test('getArrayBuffer, 404', (t) => {
        window.server.respondWith(request => {
            request.respond(404);
        });
        getArrayBuffer({ url:'' }, (error) => {
            t.equal(error.status, 404);
            t.end();
        });
        window.server.respond();
    });

    t.test('getJSON', (t) => {
        window.server.respondWith(request => {
            request.respond(200, {'Content-Type': 'application/json'}, '{"foo": "bar"}');
        });
        getJSON({ url:'' }, (error, body) => {
            t.error(error);
            t.deepEqual(body, {foo: 'bar'});
            t.end();
        });
        window.server.respond();
    });

    t.test('getJSON, invalid syntax', (t) => {
        window.server.respondWith(request => {
            request.respond(200, {'Content-Type': 'application/json'}, 'how do i even');
        });
        getJSON({ url:'' }, (error) => {
            t.ok(error);
            t.end();
        });
        window.server.respond();
    });

    t.test('getJSON, 404', (t) => {
        window.server.respondWith(request => {
            request.respond(404);
        });
        getJSON({ url:'' }, (error) => {
            t.equal(error.status, 404);
            t.end();
        });
        window.server.respond();
    });

    t.test('getJSON, 401: non-Mapbox domain', (t) => {
        window.server.respondWith(request => {
            request.respond(401);
        });
        getJSON({ url:'' }, (error) => {
            t.equal(error.status, 401);
            t.equal(error.message, "Unauthorized");
            t.end();
        });
        window.server.respond();
    });

    t.test('getJSON, 401: Mapbox domain', (t) => {
        window.server.respondWith(request => {
            request.respond(401);
        });
        getJSON({ url:'api.mapbox.com' }, (error) => {
            t.equal(error.status, 401);
            t.equal(error.message, "Unauthorized: you may have provided an invalid Mapbox access token. See https://www.mapbox.com/api-documentation/#access-tokens");
            t.end();
        });
        window.server.respond();
    });

    t.test('postData, 204(no content): no error', (t) => {
        window.server.respondWith(request => {
            request.respond(204);
        });
        postData({ url:'api.mapbox.com' }, {}, (error) => {
            t.equal(error, null);
            t.end();
        });
        window.server.respond();
    });

    t.end();
});
