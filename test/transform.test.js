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
