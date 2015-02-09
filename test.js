'use strict';

var test = require('tape');
var spec = require('./');

Object.keys(spec).forEach(function(v) {
  test(v, function(t) {
    for (var k in spec[v]) {
      // Exception for version.
      if (k === '$version') {
        t.equal(typeof spec[v].$version, 'number', '$version (number)');
      } else {
        validSchema(k, t, spec[v][k], spec[v]);
      }
    }
    t.end();
  });
});

function validSchema(k, t, obj, ref) {
  var scalar = ['boolean','string','number'];
  var types = Object.keys(ref).concat(['boolean','string','number','array','enum','color','*']);
  var keys = [
    'default',
    'doc',
    'function',
    'length',
    'required',
    'transition',
    'type',
    'value',
    'units',
    'tokens',
    'values',
    "maximum",
    "minimum",
    "period",
    "requires"
  ];

  // Schema object.
  if (Array.isArray(obj.type) || typeof obj.type === 'string') {
    // schema must have only known keys
    for (var attr in obj) {
      t.ok(keys.indexOf(attr) !== -1, k + '.' + attr, 'stray key');
    }

    // schema type must be js native, 'color', or present in ref root object.
    t.ok(types.indexOf(obj.type) !== -1, k + '.type (' + obj.type + ')');

    // schema type is an enum, it must have 'values' and they must be scalars.
    if (obj.type === 'enum') {
      t.ok(Array.isArray(obj.values) && obj.values.every(function(v) {
        return scalar.indexOf(typeof v) !== -1;
      }), k + '.values [' + obj.values +']');
    }

    // schema type is array, it must have 'value' and it must be a type.
    if (obj.value !== undefined)
      if (Array.isArray(obj.value)) {
        obj.value.forEach(function(i) {
          t.ok(types.indexOf(i) !== -1, k + '.value (' + i + ')');
        });
      } else if (typeof obj.value === 'object') {
        validSchema(k + '.value', t, obj.value, ref);
      } else {
        t.ok(types.indexOf(obj.value) !== -1, k + '.value (' + obj.value + ')');
      }

      // schema key type checks
      if (obj.doc !== undefined)
        t.equal('string', typeof obj.doc, k + '.doc (string)');
      if (obj.function !== undefined) {
        if (ref.$version >= 7) {
          t.equal(true, ['interpolated', 'piecewise-constant'].indexOf(obj.function) >= 0);
        } else {
          t.equal('boolean', typeof obj.function, k + '.required (boolean)');
        }
      }
      if (obj.required !== undefined)
        t.equal('boolean', typeof obj.required, k + '.required (boolean)');
      if (obj.transition !== undefined)
        t.equal('boolean', typeof obj.transition, k + '.transition (boolean)');
      if (obj.requires !== undefined)
        t.equal(true, Array.isArray(obj.requires), k + '.requires (array)')
      // Array of schema objects or references.
  } else if (Array.isArray(obj)) {
    obj.forEach(function(child, j) {
      if (typeof child === 'string' && scalar.indexOf(child) !== -1) return;
      validSchema(k + '[' + j + ']', t,  typeof child === 'string' ? ref[child] : child, ref);
    });
    // Container object.
  } else if (typeof obj === 'object') {
    for (var j in obj) validSchema(k + '.' + j, t, obj[j], ref);
    // Invalid ref object.
  } else {
    t.ok(false, 'Invalid: ' + k);
  }
}
