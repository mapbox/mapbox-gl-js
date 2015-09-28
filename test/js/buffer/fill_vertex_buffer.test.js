'use strict';

var test = require('prova');
var FillVertexBuffer = require('../../../js/data/buffer/fill_vertex_buffer');

test('FillVertexBuffer', function(t) {
    t.ok(new FillVertexBuffer(), 'default buffer');
    var fillVertexes = new FillVertexBuffer();
    fillVertexes.setupViews();
    t.equal(fillVertexes.itemSize, 4);
    t.equal(fillVertexes.arrayType, 'ARRAY_BUFFER');
    t.equal(fillVertexes.add(0, 0), undefined);
    t.equal(fillVertexes.pos, 4);
    t.end();
});
