'use strict';
var test = require('tape').test;

var createBucket = require('../js/geometry/createbucket.js');
var BufferSet = require('../js/geometry/bufferset.js');
var LineBucket = require('../js/geometry/linebucket.js');
var FillBucket = require('../js/geometry/fillbucket.js');
var SymbolBucket = require('../js/geometry/symbolbucket.js');

test('createBucket', function(t) {
    var buffers = new BufferSet();
    t.ok(createBucket({type: 'line'}, undefined, undefined, buffers) instanceof LineBucket);
    t.ok(createBucket({type: 'fill'}, undefined, undefined, buffers) instanceof FillBucket);
    t.ok(createBucket({type: 'symbol'}, undefined, undefined, buffers) instanceof SymbolBucket);
    t.end();
});
