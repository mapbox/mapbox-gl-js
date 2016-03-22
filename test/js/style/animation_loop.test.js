'use strict';

var test = require('tap').test;
var AnimationLoop = require('../../../js/style/animation_loop');

test('animationloop', function(t) {
    var loop = new AnimationLoop();
    t.equal(loop.stopped(), true, 'starts stopped');
    t.equal(loop.n, 0, 'starts with zero animations');
    t.equal(loop.set(1000), 0, 'returns an id for cancelling animations');
    t.equal(loop.stopped(), false, 'and then is not');
    loop.cancel(0);
    t.deepEqual(loop.times, [], 'can cancel an animation');
    t.equal(loop.stopped(), true, 'and then is stopped');

    t.end();
});
