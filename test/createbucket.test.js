'use strict';
var test = require('tape').test;

var createBucket = require('../js/geometry/createbucket.js');
var LineVertexBuffer = require('../js/geometry/linevertexbuffer.js');
var LineElementBuffer = require('../js/geometry/lineelementbuffer.js');
var FillVertexBuffer = require('../js/geometry/fillvertexbuffer.js');
var FillElementBuffer = require('../js/geometry/fillelementsbuffer.js');
var GlyphVertexBuffer = require('../js/geometry/glyphvertexbuffer.js');
var IconVertexBuffer = require('../js/geometry/iconvertexbuffer.js');
var LineBucket = require('../js/geometry/linebucket.js');
var FillBucket = require('../js/geometry/fillbucket.js');
var SymbolBucket = require('../js/geometry/symbolbucket.js');

test('createBucket', function(t) {
    var buffers = {
        glyphVertex: new GlyphVertexBuffer(),
        iconVertex: new IconVertexBuffer(),
        fillVertex: new FillVertexBuffer(),
        fillElement: new FillElementBuffer(),
        lineVertex: new LineVertexBuffer(),
        lineElement: new LineElementBuffer()
    };
    t.ok(createBucket({type: 'line'}, undefined, undefined, buffers) instanceof LineBucket);
    t.ok(createBucket({type: 'fill'}, undefined, undefined, buffers) instanceof FillBucket);
    t.ok(createBucket({type: 'symbol'}, undefined, undefined, buffers) instanceof SymbolBucket);
    t.end();
});
