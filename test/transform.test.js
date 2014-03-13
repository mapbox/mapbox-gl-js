var expect = require('expect.js');

var Transform = require('../js/ui/transform.js');
var VertexBuffer = require('../js/geometry/linevertexbuffer.js');

describe('transform', function() {
    it('creates a transform', function() {
        var t = new Transform(256);
        t.setSize(500, 500);
        expect(t.tileSize).to.eql(256);
        expect(t.worldSize).to.eql(256);
        expect(t.width).to.eql(500);
        expect(t.height).to.eql(500);
    });

    it('has a default zoom', function() {
        var t = new Transform(256);
        t.setSize(500, 500);
        expect(t.tileZoom).to.eql(0);
        expect(t.tileZoom).to.eql(t.zoom);
    });
});

describe('vertex buffer', function() {
    it('is initialized', function() {
        var buf = new VertexBuffer();
        expect(buf.index).to.eql(0);
        expect(buf.length).to.eql(32768);
    });
});
