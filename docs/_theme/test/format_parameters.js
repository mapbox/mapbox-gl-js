var test = require('tap').test;
var formatParameters = require('../lib/format_parameters');

test('main', function (t) {
  t.deepEqual(formatParameters({}), '');
  t.deepEqual(formatParameters({ params: [] }), '()');
  t.deepEqual(formatParameters({ params: [{ name: 'foo' }] }), '(foo: )');
  t.deepEqual(formatParameters({ params: [{ name: 'foo', type: { type: 'OptionalType' } }] }), '(foo: [])');
  t.done();
});
