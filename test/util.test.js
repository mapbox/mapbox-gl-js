describe('util', function() {
    describe('#frame', function() {
        it('grabs a frame', function(done) {
            frame(function() {
                done();
            });
        });
    });
    describe('#timed', function() {
        it('does a simple ramp over time', function(done) {
            var n = -1;
            timed(function(t) {
                expect(t > n).to.eql(true);
                n = t;
                if (t == 1) done();
            }, 100);
        });
    });
    describe('vector operations', function() {
        describe('#vectorMag', function() {
            it('gets the magnitude of a vector', function() {
                expect(vectorMag([0, 2])).to.eql(2);
                expect(vectorMag([0, 0])).to.eql(0);
                expect(vectorMag([10, 0])).to.eql(10);
            });
        });
        describe('#normal', function() {
            it('computes a normal vector', function() {
                expect(normal({ x: 0, y: 0}, { x: 0, y: 1000 }))
                    .to.eql({ x: 0, y: 1 });
            });
        });
        describe('#vectorAdd', function() {
            it('adds two vectors', function() {
                expect(vectorAdd([0, 0], [10, 10]))
                    .to.eql([10, 10]);
            });
        });
        describe('#vectorSub', function() {
            it('adds subtracts a vector from another', function() {
                expect(vectorSub([0, 0], [10, 10]))
                    .to.eql([-10, -10]);
            });
        });
    });
});
