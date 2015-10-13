'use strict';

var test = require('prova');
var createBucket = require('../../../js/data/create_bucket');
var BufferSet = require('../../../js/data/buffer_set');

test('createBucket', function(t) {
    var buffers = new BufferSet();
    t.equal(createBucket({type: 'line'}, buffers).type, 'line');
    t.equal(createBucket({type: 'fill'}, buffers).type, 'fill');
    t.ok(createBucket({type: 'symbol'}, buffers).type, 'symbol');
    t.end();
});
