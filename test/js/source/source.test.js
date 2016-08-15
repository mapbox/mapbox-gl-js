'use strict';

var test = require('tap').test;
var Source = require('../../../js/source/source');

test('Source', function (t) {
    t.test('#getCustomTypeNames', function (t) {
        t.same(Source.getCustomTypeNames(), []);
        Source.addType('source.test.type-1', function () {});
        t.same(Source.getCustomTypeNames(), ['source.test.type-1']);
        t.end();
    });

    t.test('#addType', function (t) {
        function SourceType () {}
        Source.on('_add', onAdd);

        t.plan(2);
        Source.addType('source.test.type-2', SourceType);
        t.equal(Source.getType('source.test.type-2'), SourceType);
        function onAdd (event) {
            t.equal(event.name, 'source.test.type-2');
            Source.off('_add', onAdd);
        }
    });

    t.test('#addType throws for duplicate source type', function (t) {
        Source.addType('source.test.type-3', function () {});
        t.throws(function () {
            Source.addType('source.test.type-3', function () {});
        });
        t.end();
    });

    t.end();
});
