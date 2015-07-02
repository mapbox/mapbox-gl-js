'use strict';

var browser = require('../util/browser.js');
var util = require('../util/util.js');

module.exports = drawCircles;

var PROPERTIES = [
    {
        styleName: 'circle-color',
        styleType: 'color',
        name: 'color',
        glWidth: 4,
        glType: '4fv'
    },
    {
        styleName: 'circle-blur',
        styleType: 'number',
        name: 'blur',
        glWidth: 2,
        glType: '1f'
    },
    {
        styleName: 'circle-radius',
        styleType: 'number',
        name: 'size',
        glWidth: 2,
        glType: '1f'
    },
    {
        styleName: 'circle-opacity',
        styleType: 'number',
        glName: 'a_opacity',
        glWidth: 1,
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

    for (var i = 0; i < PROPERTIES.length; i++) {
        var property = PROPERTIES[i];
        if (!offsets[property.styleName]) {
            var value = (
                layer.paint[property.styleName] ||
                layer.layout[property.styleName]
            );

            if (property.styleName === 'circle-opacity') {
                value = value * 255;
            }

            if (property.styleName === 'circle-blur') {
                value = Math.max(value, antialias) * 10;
            }

            util.assert(shader['a_' + property.name]);

            gl.disableVertexAttribArray(shader['a_' + property.name]);
            gl['vertexAttrib' + property.glType](shader['a_' + property.name], value);
        }
    }

    for (var k = 0; k < elementGroups.groups.length; k++) {
        var group = elementGroups.groups[k];

        vertex.bind(gl);
        elements.bind(gl);

        vertex.bindVertexAttribute(gl, shader, group.vertexStartIndex, 'pos');
        for (var j = 0; j < PROPERTIES.length; j++) {
            property = PROPERTIES[j];
            if (offsets[property.styleName]) {
                vertex.bindVertexAttribute(gl, shader, group.vertexStartIndex, property.name);
            }
        }

        var count = group.elementLength * 3;
        gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, elements.getIndexOffset(group.elementStartIndex));
    }

    gl.enable(gl.STENCIL_TEST);
}
