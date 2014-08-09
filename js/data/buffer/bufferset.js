'use strict';

var LineVertexBuffer = require('./linevertexbuffer.js');
var LineElementBuffer = require('./lineelementbuffer.js');
var FillVertexBuffer = require('./fillvertexbuffer.js');
var FillElementBuffer = require('./fillelementsbuffer.js');
var OutlineElementBuffer = require('./outlineelementsbuffer.js');
var GlyphVertexBuffer = require('./glyphvertexbuffer.js');
var IconVertexBuffer = require('./iconvertexbuffer.js');

module.exports = function(bufferset) {
    bufferset = bufferset || {};
    return {
        glyphVertex: new GlyphVertexBuffer(bufferset.glyphVertex),
        iconVertex: new IconVertexBuffer(bufferset.iconVertex),
        fillVertex: new FillVertexBuffer(bufferset.fillVertex),
        fillElement: new FillElementBuffer(bufferset.fillElement),
        outlineElement: new OutlineElementBuffer(bufferset.outlineElement),
        lineVertex: new LineVertexBuffer(bufferset.lineVertex),
        lineElement: new LineElementBuffer(bufferset.lineElement)
    };
};
