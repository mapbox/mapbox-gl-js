'use strict';

var test = require('prova');
var createBucket = require('../../../js/data/create_bucket');
var BufferSet = require('../../../js/data/buffer/buffer_set');
var LineBucket = require('../../../js/data/line_bucket');
var FillBucket = require('../../../js/data/fill_bucket');
var SymbolBucket = require('../../../js/data/symbol_bucket');

test('createBucket', function(t) {
    var buffers = new BufferSet();
    t.ok(createBucket({layer: {type: 'line'}, buffers: buffers}) instanceof LineBucket);
    t.ok(createBucket({layer: {type: 'fill'}, buffers: buffers}) instanceof FillBucket);
    t.ok(createBucket({layer: {type: 'symbol'}, buffers: buffers}) instanceof SymbolBucket);
    t.end();
});
