'use strict';

var browser = require('../util/browser.js');

module.exports = drawCircles;

var PROPERTIES = [
    {
        styleName: 'circle-color',
        styleType: 'color',
        glName: 'a_color',
        glWidth: 4,
        glType: '4fv'
    },
    {
        styleName: 'circle-blur',
        styleType: 'number',
        glName: 'a_blur',
        glWidth: 2,
        glType: '1f'
    },
    {
        styleName: 'circle-radius',
        styleType: 'number',
        glName: 'a_size',
        glWidth: 2,
        glType: '1f'
    }
];

function drawCircles(painter, layer, posMatrix, tile) {
    // short-circuit if tile is empty
    if (!tile.buffers) return;

    var elementGroups = tile.elementGroups[layer.ref || layer.id];
    if (!elementGroups) return;

    var gl = painter.gl;

    // Allow circles to be drawn across boundaries, so that
    // large circles are not clipped to tiles
    gl.disable(gl.STENCIL_TEST);

    gl.switchShader(painter.circleShader, tile.posMatrix, tile.exMatrix);

    var vertex = tile.buffers.circleVertex;
    var shader = painter.circleShader;
    var elements = tile.buffers.circleElement;

    var offsets = elementGroups.offsets;

    // antialiasing factor: this is a minimum blur distance that serves as
    // a faux-antialiasing for the circle. since blur is a ratio of the circle's
    // size and the intent is to keep the blur at roughly 1px, the two
    // are inversely related.
    var antialias = 1 / browser.devicePixelRatio / layer.paint['circle-radius'];
    layer.paint['circle-blur'] = Math.max(layer.paint['circle-blur'], antialias);

    for (var i = 0; i < PROPERTIES.length; i++) {
        var property = PROPERTIES[i];
        if (offsets[property.styleName] === undefined) {
            var value = (
                layer.paint[property.styleName] ||
                layer.layout[property.styleName]
            );
            gl.disableVertexAttribArray(shader[property.glName]);
            gl['vertexAttrib' + property.glType](shader[property.glName], value);
        }
    }

    for (var k = 0; k < elementGroups.groups.length; k++) {
        var group = elementGroups.groups[k];
        var offset = group.vertexStartIndex * vertex.itemSize;

        vertex.bind(gl, shader, offset);
        elements.bind(gl, shader, offset);

        gl.vertexAttribPointer(shader.a_pos, 2, gl.SHORT, false, elementGroups.itemSize, offset + 0);

        for (var i = 0; i < PROPERTIES.length; i++) {
            var property = PROPERTIES[i];
            if (offsets[property.styleName] !== undefined) {
                gl.vertexAttribPointer(shader[property.glName], property.glWidth, gl.UNSIGNED_BYTE, false, elementGroups.itemSize, offset + offsets[property.styleName]);
            }
        }

        var count = group.elementLength * 3;
        var elementOffset = group.elementStartIndex * elements.itemSize;
        gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, elementOffset);
    }

    gl.enable(gl.STENCIL_TEST);
}
