'use strict';

var LineVertexBuffer = require('./line_vertex_buffer');
var LineElementBuffer = require('./line_element_buffer');
var FillVertexBuffer = require('./fill_vertex_buffer');
var FillElementBuffer = require('./triangle_element_buffer');
var OutlineElementBuffer = require('./outline_element_buffer');
var GlyphVertexBuffer = require('./glyph_vertex_buffer');
var GlyphElementBuffer = require('./triangle_element_buffer');
var IconVertexBuffer = require('./icon_vertex_buffer');
var IconElementBuffer = require('./triangle_element_buffer');
var CollisionBoxVertexBuffer = require('./collision_box_vertex_buffer');
var CircleVertexBuffer = require('./circle_vertex_buffer');
var CircleElementBuffer = require('./triangle_element_buffer');

module.exports = function(bufferset) {
    bufferset = bufferset || {};
    return {
        glyphVertex: new GlyphVertexBuffer(bufferset.glyphVertex),
        glyphElement: new GlyphElementBuffer(bufferset.glyphElement),
        iconVertex: new IconVertexBuffer(bufferset.iconVertex),
        iconElement: new IconElementBuffer(bufferset.iconElement),
        circleVertex: new CircleVertexBuffer(bufferset.circleVertex),
        circleElement: new CircleElementBuffer(bufferset.circleElement),
        fillVertex: new FillVertexBuffer(bufferset.fillVertex),
        fillElement: new FillElementBuffer(bufferset.fillElement),
        outlineElement: new OutlineElementBuffer(bufferset.outlineElement),
        lineVertex: new LineVertexBuffer(bufferset.lineVertex),
        lineElement: new LineElementBuffer(bufferset.lineElement),
        collisionBoxVertex: new CollisionBoxVertexBuffer(bufferset.collisionBoxVertex)
    };
};
