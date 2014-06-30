'use strict';

var test = require('tape').test,
    WorkerTile = require('../js/worker/workertile.js');

// Stub for code coverage

test('basic', function(t) {
    new WorkerTile(null, {});
    t.end();
});
