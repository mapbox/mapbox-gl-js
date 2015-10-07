'use strict';

var test = require('prova');
var createBucket = require('../../../js/data/create_bucket');
var BufferSet = require('../../../js/data/buffer_set');
var LineBucket = require('../../../js/data/line_bucket');
var FillBucket = require('../../../js/data/fill_bucket');
var SymbolBucket = require('../../../js/data/symbol_bucket');

test('createBucket', function(t) {
    var buffers = new BufferSet();
    t.ok(createBucket({type: 'line'}, buffers) instanceof LineBucket);
    t.ok(createBucket({type: 'fill'}, buffers) instanceof FillBucket);
    t.ok(createBucket({type: 'symbol'}, buffers) instanceof SymbolBucket);
    t.end();
});
