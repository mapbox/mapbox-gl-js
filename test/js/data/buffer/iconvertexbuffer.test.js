'use strict';
var test = require('tape').test;

var Buffer = require('../../../js/data/buffer/buffer.js'),
    IconVertexBuffer = require('../../../js/data/buffer/iconvertexbuffer.js');

test('IconVertexBuffer', function(t) {
    var buf = new Buffer();
    t.ok(new IconVertexBuffer(buf), 'default buffer');
    var iconBuffer = new IconVertexBuffer(buf);
    iconBuffer.setupViews();
    t.equal(iconBuffer.itemSize, 20);
    t.equal(iconBuffer.add(0, 0, 0, 0, 0, 0, 0, 0, [0, 0], 0, 0), undefined);
    t.equal(iconBuffer.pos, 20);
    t.end();
});
