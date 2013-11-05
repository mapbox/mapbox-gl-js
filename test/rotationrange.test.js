var expect = require('expect.js');

var rc = require('../js/rotationrange.js');
var PI = Math.PI;

function deg(x) { return x/PI * 180; }

describe('#rotationRange', function() {
    it('', function() {
        var c = rc.rotationRange({
            anchor: {
                x: 2736,
                y: 3433
            },
            box: {
                x1: 2313,
                x2: 2433,
                y1: 3361,
                y2: 3529
            },
            rotate: true,
        },{
            anchor: {
                x: 2735,
                y: 2825
            },
            box: {
                x1: 2762,
                x2: 2930,
                y1: 2807,
                y2: 2903
            },
            rotate: true,
            range: [Math.PI * 2, 0]
        });
        console.log(c);
    });
    /*
    it('', function() {
        var c = rc.rotationRange({
            anchor: {
                x: 2359,
                y: 3471
            },
            box: {
                x1: 2545,
                x2: 2665,
                y1: 3393,
                y2: 3561
            },
            rotate: true,
        }, {
            anchor: {
                x: 1247,
                y: 2443
            },
            box: {
                x1: 1934,
                x2: 2054,
                y1: 2395,
                y2: 2539
            },
            rotate: true,
            range: [Math.PI * 2, 0]
        });
        console.log(c, c.map(deg));
    });
        */
});

/*
describe('#mergeCollisions', function() {
    it('merges overlapping ranges', function() {
        expect(rc.mergeCollisions([[3/8*PI, 5/8*PI], [4/8*PI, 6/8*PI], [1/8*PI, 2/8*PI]], [2*PI, 0]))
        .to.eql([1/8*PI, 6/8*PI]);
    });
    it('ignore collision within ignore range', function() {
        expect(rc.mergeCollisions([[PI/2, PI], [5/4*PI, 6/4*PI]], [0, PI]))
        .to.eql([5/4*PI, 6/4*PI]);
    });
    it('crop collision that ends within ignore range', function() {
        expect(rc.mergeCollisions([[1/2*PI, PI]], [3/4*PI, 3/2*PI]))
        .to.eql([1/2*PI, 3/4*PI]);
    });
    it('crop collision that starts within ignore range', function() {
        expect(rc.mergeCollisions([[1/2*PI, PI]], [1/4*PI, 3/4*PI]))
        .to.eql([3/4*PI, PI]);
    });

});

describe('#rotatingFixedCollision', function() {
    it('returns collisions', function() {
        var collisions = rc.rotatingFixedCollisions({
            anchor: { x: 0, y: 0 },
            box: { x1: -1, x2: 0, y1: 0, y2: 1 }
        }, {
            box: { x1: 1.4142, x2: 10, y1: -10, y2: 10 }
        });
        expect(collisions.length).to.eql(1);
        expect(Math.round(deg(collisions[0][0]))).to.eql(135);
        expect(Math.round(deg(collisions[0][1]))).to.eql(135);
    });
});

describe('#cornerBoxCollisions', function() {
    it('returns intersections in sorted order as angles 0..2PI', function() {
        expect(rc.cornerBoxCollisions(
                { x: 1, y: 1 },
                { x: 2, y: 2 },
                [{ x: 1, y: 1}, { x: 1, y: 10 }, { x: 10, y: 10}, { x: 10, y: 1 }]))
            .to.eql([[PI/4, PI * 7/4]]);
    });

    it('handles no intersections', function() {
        expect(rc.cornerBoxCollisions(
                { x: 1, y: 1 },
                { x: 200, y: 200 },
                [{ x: 1, y: 1}, { x: 1, y: 10 }, { x: 10, y: 10}, { x: 10, y: 1 }]))
            .to.eql([]);
    });
});

describe('#circleEdgeCollisions', function() {
    it('handles two intersection points', function() {
        expect(rc.circleEdgeCollisions(
                { x: 1, y: 1 },
                1,
                { x: -10, y: 1}, { x: 10, y: 1}))
        .to.eql([{ x: 0, y: 1}, { x: 2, y: 1 }]);
    });

    it('handles one intersection point', function() {
        expect(rc.circleEdgeCollisions(
                { x: 1, y: 1 },
                1,
                { x: 1, y: 1}, {x: 10, y: 1 }))
        .to.eql([{ x: 2, y: 1}]);
    });

    it('only returns intersections within the line segment', function() {
        expect(rc.circleEdgeCollisions(
                { x: 1, y: 1},
                1,
                { x: 3, y: 1}, { x: 30, y: 1 }))
        .to.eql([]);
    });

    it('doesnt count tangetial intersections as collisions', function() {
        expect(rc.circleEdgeCollisions(
                { x: 1, y: 1},
                1,
                { x: -10, y: 0}, { x: 10, y: 0 }))
        .to.eql([]);
    });

});

describe('#rotatingRotatingCollisions', function() {
    it('basically works', function() {
        var root2 = Math.sqrt(2);
        var c = rc.rotatingRotatingCollisions({
            anchor: { x: 0, y: 0 },
            box: { x1: -1, x2: 1, y1: 0, y2: 0 }
        }, {
            anchor: { x: 1, y: 1 },
            box: { x1: 0, x2: 2, y1: 1, y2: 1 }
        });

        expect(Math.round(deg(c[0][0]))).to.eql(135);
        expect(Math.round(deg(c[0][1]))).to.eql(135);
        expect(Math.round(deg(c[1][0]))).to.eql(315);
        expect(Math.round(deg(c[1][1]))).to.eql(315);
    });
});
*/
