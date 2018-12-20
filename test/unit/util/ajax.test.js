import { test } from 'mapbox-gl-js-test';
import {
    getArrayBuffer,
    getJSON,
    postData,
    getImage,
    resetImageRequestQueue
} from '../../../src/util/ajax';
import window from '../../../src/util/window';
import config from '../../../src/util/config';

test('ajax', (t) => {
    t.beforeEach(callback => {
        window.useFakeXMLHttpRequest();
        callback();
    });

    t.afterEach(callback => {
        window.restore();
        callback();
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
        postData({ url:'api.mapbox.com' }, (error) => {
            t.equal(error, null);
            t.end();
        });
        window.server.respond();
    });

    t.test('getImage respects maxParallelImageRequests', (t) => {
        window.server.respondWith(request => request.respond(200, {'Content-Type': 'image/png'}, ''));

        const maxRequests = config.MAX_PARALLEL_IMAGE_REQUESTS;

        // jsdom doesn't call image onload; fake it https://github.com/jsdom/jsdom/issues/1816
        const jsdomImage = window.Image;
        window.Image = class {
            set src(src) {
                setTimeout(() => this.onload());
            }
        };

        function callback(err) {
            if (err) return;
            // last request is only added after we got a response from one of the previous ones
            t.equals(window.server.requests.length, maxRequests + 1);
            window.Image = jsdomImage;
            t.end();
        }

        for (let i = 0; i < maxRequests + 1; i++) {
            getImage({url: ''}, callback);
        }
        t.equals(window.server.requests.length, maxRequests);

        window.server.requests[0].respond();
    });

    t.test('getImage cancelling frees up request for maxParallelImageRequests', (t) => {
        resetImageRequestQueue();

        window.server.respondWith(request => request.respond(200, {'Content-Type': 'image/png'}, ''));

        const maxRequests = config.MAX_PARALLEL_IMAGE_REQUESTS;

        // jsdom doesn't call image onload; fake it https://github.com/jsdom/jsdom/issues/1816
        const jsdomImage = window.Image;
        window.Image = class {
            set src(src) {
                setTimeout(() => this.onload());
            }
        };

        for (let i = 0; i < maxRequests + 1; i++) {
            getImage({url: ''}, () => t.fail).cancel();
        }
        t.equals(window.server.requests.length, maxRequests + 1);
        window.Image = jsdomImage;
        t.end();
    });

    t.end();
});
