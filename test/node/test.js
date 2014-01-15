var test = require('tap').test,
    gl = require('../../');

test('loadTile', function(t) {
    'use strict';
    t.plan(2);
    gl.loadTile('plain', 0, 0, 0, function(err, res) {
        t.equal(err, null, 'error is null');
        t.type(res, 'object', 'tile is an object');
    });
});

test('loadTile/invalid', function(t) {
    'use strict';
    t.plan(2);
    gl.loadTile('plain', 0, -1, -1, function(err, res) {
        t.type(err, 'object', 'error is present for invalid tiles');
        t.type(res, 'undefined', 'tile is undefined for invalid tiles');
    });
});

test('convertTile/invalid', function(t) {
    'use strict';
    t.plan(2);
    gl.convertTile('plain', 0, -1, -1, function(err, res) {
        t.type(err, 'object', 'error is present for invalid tiles');
        t.type(res, 'undefined', 'tile is undefined for invalid tiles');
    });
});

test('convertTile', function(t) {
    'use strict';
    t.plan(2);
    gl.convertTile('plain', 0, 0, 0, function(err, res) {
        t.equal(err, null, 'error is null');
        t.type(res, 'object', 'tile is an object');
    });
});
