'use strict';

var TriangleElementBuffer = require('./triangle_element_buffer');
var LineVertexBuffer = require('./line_vertex_buffer');
var FillVertexBuffer = require('./fill_vertex_buffer');
var OutlineElementBuffer = require('./outline_element_buffer');
var SymbolVertexBuffer = require('./symbol_vertex_buffer');
var CollisionBoxVertexBuffer = require('./collision_box_vertex_buffer');
var CircleVertexBuffer = require('./circle_vertex_buffer');

module.exports = function(bufferset) {
    bufferset = bufferset || {};
    return {
        glyphVertex: new SymbolVertexBuffer(bufferset.glyphVertex),
        glyphElement: new TriangleElementBuffer(bufferset.glyphElement),

        iconVertex: new SymbolVertexBuffer(bufferset.iconVertex),
        iconElement: new TriangleElementBuffer(bufferset.iconElement),

        circleVertex: new CircleVertexBuffer(bufferset.circleVertex),
        circleElement: new TriangleElementBuffer(bufferset.circleElement),

        fillVertex: new FillVertexBuffer(bufferset.fillVertex),
        fillElement: new TriangleElementBuffer(bufferset.fillElement),

        outlineElement: new OutlineElementBuffer(bufferset.outlineElement),

        lineVertex: new LineVertexBuffer(bufferset.lineVertex),
        lineElement: new TriangleElementBuffer(bufferset.lineElement),

        collisionBoxVertex: new CollisionBoxVertexBuffer(bufferset.collisionBoxVertex)
    };
};
