'use strict';
var test = require('tape').test;

var FillBucket = require('../js/geometry/fillbucket.js');
var FillVertexBuffer = require('../js/geometry/fillvertexbuffer.js');
var FillElementBuffer = require('../js/geometry/fillelementsbuffer.js');
var Point = require('../js/geometry/point.js');

test('FillBucket', function(t) {
    var info = {};
    var buffers = {
        fillVertex: new FillVertexBuffer(),
        fillElement: new FillElementBuffer()
    };
    var bucket = new FillBucket(info, buffers);
    t.ok(bucket);

    t.equal(bucket.addFill([
        new Point(0, 0),
        new Point(10, 10)
    ]), undefined);

    t.equal(bucket.addFill([
        new Point(0, 0),
        new Point(10, 10),
        new Point(10, 20)
    ]), undefined);

    t.end();
});

