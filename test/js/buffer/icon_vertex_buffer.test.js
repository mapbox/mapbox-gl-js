'use strict';

var test = require('prova');
var IconVertexBuffer = require('../../../js/data/buffer/icon_vertex_buffer');

test('IconVertexBuffer', function(t) {
    t.ok(new IconVertexBuffer(), 'default buffer');
    var iconBuffer = new IconVertexBuffer();
    iconBuffer.setupViews();
    t.equal(iconBuffer.itemSize, 16);
    t.equal(iconBuffer.add(0, 0, 0, 0, 0, 0, 0, 0, 0), undefined);
    t.equal(iconBuffer.pos, 16);
    t.end();
});
