'use strict';
var test = require('tape').test;

var createBucket = require('../../../js/data/createbucket.js');
var BufferSet = require('../../../js/data/buffer/bufferset.js');
var LineBucket = require('../../../js/data/linebucket.js');
var FillBucket = require('../../../js/data/fillbucket.js');
var SymbolBucket = require('../../../js/data/symbolbucket.js');

test('createBucket', function(t) {
    var buffers = new BufferSet();
    t.ok(createBucket({type: 'line'}, buffers) instanceof LineBucket);
    t.ok(createBucket({type: 'fill'}, buffers) instanceof FillBucket);
    t.ok(createBucket({type: 'symbol'}, buffers) instanceof SymbolBucket);
    t.end();
});
