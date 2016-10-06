'use strict';

const test = require('mapbox-gl-js-test').test;
const ajax = require('../../../js/util/ajax');
const window = require('../../../js/util/window');

test('ajax', (t) => {
    t.beforeEach(callback => {
        window.useFakeXMLHttpRequest();
        callback();
    });

    t.afterEach(callback => {
        window.restore();
        callback();
    });
    t.test('getArrayBuffer', (t) => {
        const url = '/buffer-request';
        window.server.respondWith(request => {
            request.respond(200, {'Content-Type': 'image/png'}, '');
        });
        ajax.getArrayBuffer(url, (error) => {
            t.pass('called getArrayBuffer');
            t.ok(error, 'should error when the status is 200 without content.');
            t.end();
        });
        window.server.respond();
    });
    t.end();
});
