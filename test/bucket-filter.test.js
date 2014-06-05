'use strict';
var test = require('tape').test;

var filter = require('../js/style/bucket-filter.js');

function createFilter(json) {
	return filter({filter: json});
}

test('bucketFilter', function(t) {
	t.test('filters by all properties in the root', function(t) {

		var f = createFilter({foo: 'bar', bar: 5});

		t.equal(typeof f, 'function');
		t.ok(f({foo: 'bar', bar: 5, z: 5}));
		t.end();
	});

	t.test('returns undefined if no filter specified', function(t) {

		t.equal(typeof filter({}), 'undefined');
		t.equal(typeof createFilter({}), 'undefined');
		t.end();
	});

	t.test('matches one of the values if array is specified', function(t) {

		var f = createFilter({foo: ['bar', 'baz']});

		t.ok(f({foo: 'bar', z: 5}));
		t.ok(f({foo: 'baz', z: 5}));
		t.end();
	});

	t.test('doesn\'t filter if one of the fields doesn\'t match', function(t) {

		var f = createFilter({foo: 'bar', bar: 5});

		t.notOk(f({foo: 'bar', z: 5}));
		t.end();
	});

	function operatorTest(operator, value, goodValues, badValues) {
		return function(t) {
			var op = {};
			op[operator] = value; // e.g. {'>': 5}

			var f = createFilter({foo: op}), i;

			for (i = 0; i < badValues.length; i++) {
				t.notOk(f({foo: badValues[i]}));
			}
			for (i = 0; i < badValues.length; i++) {
				t.ok(f({foo: goodValues[i]}));
			}
			t.end();
		}
	}

	t.test('operator >', operatorTest('>', 5, [6, 10], [4, 5]));
	t.test('operator <', operatorTest('<', 5, [3, 4], [5, 10]));
	t.test('operator <=', operatorTest('<=', 5, [3, 5], [6, 10]));
	t.test('operator >=', operatorTest('>=', 5, [5, 10], [3, 4]));
	t.test('operator !=, numbers', operatorTest('!=', 5, [4, 6], [5]));
	t.test('operator !=, strings', operatorTest('!=', 'foo', ['fooz'], ['foo']));

	t.test('multiple operators', function(t) {
		var f = createFilter({foo: {'>': 5, '<=': 7}});

		t.notOk(f({foo: 5}));
		t.ok(f({foo: 6}));
		t.ok(f({foo: 7}));
		t.notOk(f({foo: 8}));
		t.end();
	});

	t.test('operator ||', function(t) {
		var f = createFilter({
			'||': [
				{'foo': {'<': 5}},
				{'bar': 'baz'}
			]
		});

		t.ok(f({'foo': 4}));
		t.ok(f({'bar': 'baz'}));
		t.notOk(f({'foo': 5}));
		t.notOk(f({'bar': 'foo'}));
		t.end();
	});

	t.test('operator &&', function(t) {
		var f = createFilter({
			'&&': [
				{'foo': {'<': 5}},
				{'bar': 'baz'}
			]
		});

		t.ok(f({'foo': 3, 'bar': 'baz', 'baz': 5}));
		t.notOk(f({'foo': 2}));
		t.notOk(f({'bar': 'baz'}));
		t.end();
	});

	t.test('operator ! ($not)', function(t) {
		var f = createFilter({
			'!': {
				'foo': {'<': 5},
				'bar': 'baz'
			}
		});

		t.ok(f({'foo': 3, 'bar': 5}));
		t.ok(f({'foo': 5, 'bar': 'baz'}));
		t.notOk(f({'foo': 3, 'bar': 'baz', 'baz': 5}));
		t.end();
	});

	t.test('operator ! ($nor)', function(t) {
		var f = createFilter({
			'!': [
				{'foo': {'<': 5}},
				{'bar': 'baz'}
			]
		});

		t.notOk(f({'foo': 3, 'bar': 5}));
		t.notOk(f({'foo': 5, 'bar': 'baz'}));
		t.notOk(f({'foo': 3, 'bar': 'baz', 'baz': 5}));
		t.ok(f({'foo': 6, 'bar': 5, 'baz': 5}));
		t.end();
	});
});
