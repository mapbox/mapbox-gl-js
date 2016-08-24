'use strict';

var test = require('tap').test;
var Source = require('../../../js/source/source');
var proxyquire = require('proxyquire');

test('Source#addType', function (t) {
    t.test('adds source type', function (t) {
        // expect no call to load worker source
        var Source = proxyquire('../../../js/source/source', {
            '../util/dispatcher': function () {
                t.fail();
            }
        });

        var SourceType = function () {};

        Source.addType('foo', SourceType, function (err) {
            t.error(err);
            t.equal(Source.getType('foo'), SourceType);
            t.end();
        });
    });

    t.test('triggers workers to load worker source code', function (t) {
        var SourceType = function () {};
        SourceType.workerSourceURL = 'worker-source.js';

        var Source = proxyquire('../../../js/source/source', {
            '../util/dispatcher': function () {
                this.broadcast = function (type, params) {
                    if (type === 'load worker source') {
                        t.equal(Source.getType('bar'), SourceType);
                        t.equal(params.name, 'bar');
                        t.equal(params.url, 'worker-source.js');
                        t.end();
                    }
                };
            }
        });

        Source.addType('bar', SourceType, function (err) { t.error(err); });
    });

    t.test('throws for duplicate source type', function (t) {
        Source.addType('source.test.type-3', function () {}, function (err) {
            t.error(err);
            t.throws(function () {
                Source.addType('source.test.type-3', function () {}, function (err) {
                    t.error(err);
                    t.fail();
                });
            });
        });
        t.end();
    });

    t.end();
});
