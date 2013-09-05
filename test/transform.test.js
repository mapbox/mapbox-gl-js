describe('transform', function() {
    it('creates a transform', function() {
        var t = new Transform(256);
        t.height = 500;
        t.width = 500;
        expect(t.size).to.eql(256);
        expect(t.world).to.eql(256);
        expect(t.width).to.eql(500);
        expect(t.height).to.eql(500);
    });

    it('has a default zoom', function() {
        var t = new Transform(256);
        t.height = 500;
        t.width = 500;
        expect(t.zoom).to.eql(0);
        expect(t.zoom).to.eql(t.z);
    });
});

describe('vertex buffer', function() {
    it('is initialized', function() {
        var buf = new VertexBuffer();
        expect(buf.index).to.eql(0);
        expect(buf.length).to.eql(32768);
    });
});

describe('tile', function() {
    describe('#toID', function() {
        it('calculates an iD', function() {
            expect(Tile.toID(0, 0, 0)).to.eql(0);
            expect(Tile.toID(1, 0, 0)).to.eql(1);
            expect(Tile.toID(1, 1, 0)).to.eql(33);
            expect(Tile.toID(1, 1, 1)).to.eql(97);
        });
    });
    describe('#asString', function() {
        it('calculates strings', function() {
            expect(Tile.asString(Tile.toID(1, 1, 1))).to.eql('1/1/1');
        });
    });
    describe('#fromID', function() {
        it('forms a loop', function() {
            expect(Tile.fromID(Tile.toID(1, 1, 1))).to.eql({ z: 1, x: 1, y: 1});
            expect(Tile.fromID(0)).to.eql({ z: 0, x: 0, y: 0});
        });
    });
    describe('#url', function() {
        it('gets a url', function() {
            expect(Tile.url(1, ['{z}/{x}/{y}.json'])).to.eql('1/0/0.json');
        });
    });
    describe('#parent', function() {
        it('returns a parent id', function() {
            expect(Tile.parent(33)).to.eql(0);
            expect(Tile.parent(32)).to.eql(32);
        });
    });
});
