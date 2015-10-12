'use strict';

var test = require('prova');
var createBucket = require('../../../js/data/create_bucket');
var BufferSet = require('../../../js/data/buffer_set');
var SymbolBucket = require('../../../js/data/symbol_bucket');

test('createBucket', function(t) {
    var buffers = new BufferSet();
    t.equal(createBucket({type: 'line'}, buffers).type, 'line');
    t.equal(createBucket({type: 'fill'}, buffers).type, 'fill');
    t.ok(createBucket({type: 'symbol'}, buffers) instanceof SymbolBucket);
    t.end();
});
