'use strict';

var test = require('tap').test;
var proxyquire = require('proxyquire');
var Actor = require('../../../js/util/actor');

test('Actor', function (t) {
    t.test('forwards resopnses to correct callback', function (t) {
        var WebWorker = proxyquire('../../../js/util/web_worker', {
            '../source/worker': function Worker(self) {
                this.self = self;
                this.actor = new Actor(self, this);
                this.test = function (mapId, params, callback) {
                    setTimeout(callback, 0, null, params);
                };
            }
        });

        var worker = new WebWorker();

        var m1 = new Actor(worker, {}, 'map-1');
        var m2 = new Actor(worker, {}, 'map-2');

        t.plan(4);
        m1.send('test', { value: 1729 }, function (err, response) {
            t.error(err);
            t.same(response, { value: 1729 });
        });
        m2.send('test', { value: 4104 }, function (err, response) {
            t.error(err);
            t.same(response, { value: 4104 });
        });
    });

    t.end();
});
