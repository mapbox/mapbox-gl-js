'use strict';
var test = require('tape').test;

var filter = require('../../../js/style/bucket-filter.js');

test('bucketFilter', function(t) {
    t.test('filters by all properties in the root', function(t) {

        var f = filter({foo: 'bar', bar: 5});

        t.equal(typeof f, 'function');
        t.ok(f({properties: {foo: 'bar', bar: 5, z: 5}}));
        t.end();
    });

    t.test('returns a function that always returns true if no filter specified', function(t) {

        t.ok(filter({})({}));
        t.ok(filter()({}));
        t.end();
    });

    t.test('matches one of the values if array is specified', function(t) {

        var f = filter({foo: ['bar', 'baz']});

        t.ok(f({properties: {foo: 'bar', z: 5}}));
        t.ok(f({properties: {foo: 'baz', z: 5}}));
        t.end();
    });

    t.test('doesn\'t match null as 0', function(t) {
        var f = filter({scalerank: 0});

        t.notOk(f({properties: {scalerank: null}}));
        t.end();
    });

    t.test('doesn\'t filter if one of the fields doesn\'t match', function(t) {

        var f = filter({foo: 'bar', bar: 5});

        t.notOk(f({properties: {foo: 'bar', z: 5}}));
        t.end();
    });

    function operatorTest(operator, value, goodValues, badValues) {
        return function(t) {
            var op = {};
            op[operator] = value; // e.g. {'>': 5}

            var f = filter({foo: op}), i;

            for (i = 0; i < badValues.length; i++) {
                t.notOk(f({properties: {foo: badValues[i]}}));
            }
            for (i = 0; i < badValues.length; i++) {
                t.ok(f({properties: {foo: goodValues[i]}}));
            }
            t.end();
        };
    }

    t.test('operator >', operatorTest('>', 5, [6, 10], [4, 5]));
    t.test('operator <', operatorTest('<', 5, [3, 4], [5, 10]));
    t.test('operator <=', operatorTest('<=', 5, [3, 5], [6, 10]));
    t.test('operator >=', operatorTest('>=', 5, [5, 10], [3, 4]));
    t.test('operator !=, numbers', operatorTest('!=', 5, [4, 6], [5]));
    t.test('operator !=, strings', operatorTest('!=', 'foo', ['fooz'], ['foo']));

    t.throws(function() {
        filter({foo: { unknown: 5 } });
    }, 'unknown operator');

    t.test('multiple operators', function(t) {
        var f = filter({foo: {'>': 5, '<=': 7}});

        t.notOk(f({properties: {foo: 5}}));
        t.ok(f({properties: {foo: 6}}));
        t.ok(f({properties: {foo: 7}}));
        t.notOk(f({properties: {foo: 8}}));
        t.end();
    });

    t.test('operator ||', function(t) {
        var f = filter({
            '||': [
                {'foo': {'<': 5}},
                {'bar': 'baz'}
            ]
        });

        t.ok(f({properties: {'foo': 4}}));
        t.ok(f({properties: {'bar': 'baz'}}));
        t.notOk(f({properties: {'foo': 5}}));
        t.notOk(f({properties: {'bar': 'foo'}}));
        t.end();
    });

    t.test('operator &&', function(t) {
        var f = filter({
            '&&': [
                {'foo': {'<': 5}},
                {'bar': 'baz'}
            ]
        });

        t.ok(f({properties: {'foo': 3, 'bar': 'baz', 'baz': 5}}));
        t.notOk(f({properties: {'foo': 2}}));
        t.notOk(f({properties: {'bar': 'baz'}}));
        t.end();
    });

    t.test('operator ! ($not)', function(t) {
        var f = filter({
            '!': {
                'foo': {'<': 5},
                'bar': 'baz'
            }
        });

        t.ok(f({properties: {'foo': 3, 'bar': 5}}));
        t.ok(f({properties: {'foo': 5, 'bar': 'baz'}}));
        t.notOk(f({properties: {'foo': 3, 'bar': 'baz', 'baz': 5}}));
        t.end();
    });

    t.test('operator ! ($nor)', function(t) {
        var f = filter({
            '!': [
                {'foo': {'<': 5}},
                {'bar': 'baz'}
            ]
        });

        t.notOk(f({properties: {'foo': 3, 'bar': 5}}));
        t.notOk(f({properties: {'foo': 5, 'bar': 'baz'}}));
        t.notOk(f({properties: {'foo': 3, 'bar': 'baz', 'baz': 5}}));
        t.ok(f({properties: {'foo': 6, 'bar': 5, 'baz': 5}}));
        t.end();
    });

    t.test('operator $exists', function(t) {
        var f = filter({
            'foo': {'$exists': true}
        });

        t.ok(f({properties: {'foo': 'bar'}}));
        t.ok(f({properties: {'foo': 5}}));
        t.notOk(f({properties: {'bar': 5}}));
        t.end();
    });

    t.test('filters by type', function(t) {
        var f = filter({'$type': 'LineString'});
        t.ok(f({type: 2, properties: {}}));
        t.notOk(f({type: 1, properties: {}}));
        t.end();
    });
});
