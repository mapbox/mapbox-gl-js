describe('util', function() {
    describe('#frame', function() {
        it('grabs a frame', function(done) {
            frame(function() {
                done();
            });
        });
    });
    describe('#vectorMag', function() {
        it('gets the magnitude of a vector', function() {
            expect(vectorMag([0, 2])).to.eql(2);
            expect(vectorMag([0, 0])).to.eql(0);
            expect(vectorMag([10, 0])).to.eql(10);
        });
    });
});
