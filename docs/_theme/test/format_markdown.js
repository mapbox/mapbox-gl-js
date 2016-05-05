var test = require('tap').test;
var remark = require('remark');
var formatMarkdown = require('../lib/format_markdown');

test('main', function (t) {
  t.deepEqual(formatMarkdown(remark.parse('Converts from `Result<T>` to `?Error`')),
    '<p>Converts from <code>Result&lt;T&gt;</code> to <code>?Error</code></p>\n');
  t.done();
});

test('type', function (t) {
  var formatType = formatMarkdown.type;

  t.deepEqual(formatType(undefined), '');

  t.deepEqual(formatType({
    type: 'NameExpression',
    name: 'Foo'
  }), 'Foo');

  t.deepEqual(formatType({
    type: 'NameExpression',
    name: 'Foo'
  }, ['Foo']), '<a href="#Foo">Foo</a>');

  t.deepEqual(formatType({
    type: 'UnionType',
    elements: [
      {
        type: 'NameExpression',
        name: 'Foo'
      },
      {
        type: 'NameExpression',
        name: 'Bar'
      }
    ]
  }), '(Foo | Bar)');

  t.deepEqual(formatType({
    type: 'AllLiteral'
  }), 'Any');

  t.deepEqual(formatType({
    type: 'RestType'
  }), '...');

  t.deepEqual(formatType({
    type: 'OptionalType',
    expression: {
      type: 'NameExpression',
      name: 'Foo'
    }
  }), '[Foo]');

  t.deepEqual(formatType({
    type: 'TypeApplication',
    expression: {
      type: 'NameExpression',
      name: 'Foo'
    },
    applications: [{
      type: 'NameExpression',
      name: 'Bar'
    }]
  }), 'Foo&lt;Bar&gt;');

  t.deepEqual(formatType({
    type: 'UndefinedLiteral'
  }), '<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/'
    + 'Reference/Global_Objects/undefined">undefined</a>');

  t.done();
});

test('autolink', function (t) {
  var autolink = formatMarkdown.link;

  t.equal(autolink([], 'Foo'), 'Foo');
  t.equal(autolink(['Foo'], 'Foo'),
    '<a href="#Foo">Foo</a>');
  t.equal(autolink([], 'Array'),
    '<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array">Array</a>');
  t.equal(autolink([], 'C&O'), 'C&amp;O');

  t.done();
});
