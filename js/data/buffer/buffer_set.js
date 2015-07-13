'use strict';

var LineVertexBuffer = require('./line_vertex_buffer');
var LineElementBuffer = require('./line_element_buffer');
var FillVertexBuffer = require('./fill_vertex_buffer');
var FillElementBuffer = require('./triangle_element_buffer');
var OutlineElementBuffer = require('./outline_elements_buffer');
var GlyphVertexBuffer = require('./glyph_vertex_buffer');
var GlyphElementBuffer = require('./triangle_element_buffer');
var IconVertexBuffer = require('./icon_vertex_buffer');
var IconElementBuffer = require('./triangle_element_buffer');
var CollisionBoxVertexBuffer = require('./collision_box_vertex_buffer');

var Buffer2 = require('../buffer2');

module.exports = function BufferSet(bufferset) {
    bufferset = bufferset || {};
    return {
        glyphVertex: new GlyphVertexBuffer(bufferset.glyphVertex),
        glyphElement: new GlyphElementBuffer(bufferset.glyphElement),
        iconVertex: new IconVertexBuffer(bufferset.iconVertex),
        iconElement: new IconElementBuffer(bufferset.iconElement),
        fillVertex: new FillVertexBuffer(bufferset.fillVertex),
        fillElement: new FillElementBuffer(bufferset.fillElement),
        outlineElement: new OutlineElementBuffer(bufferset.outlineElement),
        lineVertex: new LineVertexBuffer(bufferset.lineVertex),
        lineElement: new LineElementBuffer(bufferset.lineElement),
        collisionBoxVertex: new CollisionBoxVertexBuffer(bufferset.collisionBoxVertex),

        circleVertex: new Buffer2(bufferset.circleVertex || {
            type: Buffer2.BufferTypes.VERTEX,
            attributes: {
                pos:   { components: 2, type: Buffer2.AttributeTypes.SHORT },
                color: { components: 4 },
                size:  { },
                blur:  { }
            }
        }),

        circleElement: new Buffer2(bufferset.circleElement || {
            type: Buffer2.BufferTypes.ELEMENT,
            attributes: {
                verticies: { components: 3, type: Buffer2.AttributeTypes.UNSIGNED_SHORT }
            }
        })
    };
};
