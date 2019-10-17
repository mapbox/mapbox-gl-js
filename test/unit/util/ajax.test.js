import {test} from '../../util/test';
import {
    getArrayBuffer,
    getJSON,
    postData,
    getImage,
    resetImageRequestQueue
} from '../../../src/util/ajax';
import window from '../../../src/util/window';
import config from '../../../src/util/config';
import webpSupported from '../../../src/util/webp_supported';

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
        getArrayBuffer({url:''}, (error) => {
            t.equal(error.status, 404);
            t.end();
        });
        window.server.respond();
    });

    t.test('getJSON', (t) => {
        window.server.respondWith(request => {
            request.respond(200, {'Content-Type': 'application/json'}, '{"foo": "bar"}');
        });
        getJSON({url:''}, (error, body) => {
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
        getJSON({url:''}, (error) => {
            t.ok(error);
            t.end();
        });
        window.server.respond();
    });

    t.test('getJSON, 404', (t) => {
        window.server.respondWith(request => {
            request.respond(404);
        });
        getJSON({url:''}, (error) => {
            t.equal(error.status, 404);
            t.end();
        });
        window.server.respond();
    });

    t.test('getJSON, 401: non-Mapbox domain', (t) => {
        window.server.respondWith(request => {
            request.respond(401);
        });
        getJSON({url:''}, (error) => {
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
        getJSON({url:'api.mapbox.com'}, (error) => {
            t.equal(error.status, 401);
            t.equal(error.message, "Unauthorized: you may have provided an invalid Mapbox access token. See https://www.mapbox.com/api-documentation/#access-tokens-and-token-scopes");
            t.end();
        });
        window.server.respond();
    });

    t.test('postData, 204(no content): no error', (t) => {
        window.server.respondWith(request => {
            request.respond(204);
        });
        postData({url:'api.mapbox.com'}, (error) => {
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

    t.test('getImage requests that were once queued are still abortable', (t) => {
        resetImageRequestQueue();

        const maxRequests = config.MAX_PARALLEL_IMAGE_REQUESTS;

        const requests = [];
        for (let i = 0; i < maxRequests; i++) {
            requests.push(getImage({url: ''}, () => {}));
        }

        // the limit of allowed requests is reached
        t.equals(window.server.requests.length, maxRequests);

        const queuedURL = 'this-is-the-queued-request';
        const queued = getImage({url: queuedURL}, () => t.fail());

        // the new requests is queued because the limit is reached
        t.equals(window.server.requests.length, maxRequests);

        // cancel the first request to let the queued request start
        requests[0].cancel();
        t.equals(window.server.requests.length, maxRequests + 1);

        // abort the previously queued request and confirm that it is aborted
        const queuedRequest = window.server.requests[window.server.requests.length - 1];
        t.equals(queuedRequest.url, queuedURL);
        t.equals(queuedRequest.aborted, undefined);
        queued.cancel();
        t.equals(queuedRequest.aborted, true);

        t.end();
    });

    t.test('getImage sends accept/webp when supported', (t) => {
        resetImageRequestQueue();

        window.server.respondWith((request) => {
            t.ok(request.requestHeaders.accept.includes('image/webp'), 'accepts header contains image/webp');
            request.respond(200, {'Content-Type': 'image/webp'}, '');
        });

        // mock webp support
        webpSupported.supported = true;

        // jsdom doesn't call image onload; fake it https://github.com/jsdom/jsdom/issues/1816
        window.Image = class {
            set src(src) {
                setTimeout(() => this.onload());
            }
        };

        getImage({url: ''}, () => { t.end(); });

        window.server.respond();
    });

    t.end();
});
