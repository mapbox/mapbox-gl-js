'use strict';
var test = require('tape').test;
var AnimationLoop = require('../js/style/animationloop.js');

test('animationloop', function(t) {
    var loop = new AnimationLoop();
    t.equal(loop.n, 0, 'starts with zero animations');
    t.equal(loop.set(1000), 0, 'returns an id for cancelling animations');
    loop.cancel(0);
    t.deepEqual(loop.times, [], 'can cancel an animation');
    t.end();
});
