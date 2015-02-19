'use strict';

var browser = require('../util/browser');
var Buffer = require('../data/buffer/buffer');
var mapboxGLFunction = require('mapbox-gl-function');

module.exports = function drawLine(painter, layer, posMatrix, tile) {
    // No data
    if (!tile.buffers) return;
    var elementGroups = tile.elementGroups[layer.ref || layer.id];
    if (!elementGroups) return;
    if (!elementGroups.groups.length) return;

    var gl = painter.gl;

    // don't draw zero-width lines
    if (layer.paint['line-width'] <= 0) return;

    // the distance over which the line edge fades out.
    // Retina devices need a smaller distance to avoid aliasing.
    var antialiasing = 1 / browser.devicePixelRatio;

    var blur = layer.paint['line-blur'] + antialiasing;
    var edgeWidth = layer.paint['line-width'] / 2;
    var inset = -1;
    var offset = 0;
    var shift = 0;

    if (layer.paint['line-gap-width'] > 0) {
        inset = layer.paint['line-gap-width'] / 2 + antialiasing * 0.5;
        edgeWidth = layer.paint['line-width'];

        // shift outer lines half a pixel towards the middle to eliminate the crack
        offset = inset - antialiasing / 2;
    }

    var outset = offset + edgeWidth + antialiasing / 2 + shift;

    var color = layer.paint['line-color'];
    var ratio = painter.transform.scale / (1 << tile.zoom) / 8;
    var vtxMatrix = painter.translateMatrix(posMatrix, tile.zoom, layer.paint['line-translate'], layer.paint['line-translate-anchor']);

    var shader;
    var group;
    var i;
    var colorBuffer;

    var dasharray = layer.paint['line-dasharray'];
    var image = layer.paint['line-image'];

    if (dasharray) {

        shader = painter.linesdfpatternShader;
        gl.switchShader(shader, vtxMatrix, tile.exMatrix);

        gl.uniform2fv(shader.u_linewidth, [ outset, inset ]);
        gl.uniform1f(shader.u_ratio, ratio);
        gl.uniform1f(shader.u_blur, blur);
        gl.uniform4fv(shader.u_color, color);

        var posA = painter.lineAtlas.getDash(dasharray.from, layer.layout['line-cap'] === 'round');
        var posB = painter.lineAtlas.getDash(dasharray.to, layer.layout['line-cap'] === 'round');
        painter.lineAtlas.bind(gl);

        var patternratio = Math.pow(2, Math.floor(Math.log(painter.transform.scale) / Math.LN2) - tile.zoom) / 8;
        var scaleA = [patternratio / posA.width / dasharray.fromScale, -posA.height / 2];
        var gammaA = painter.lineAtlas.width / (dasharray.fromScale * posA.width * 256 * browser.devicePixelRatio) / 2;
        var scaleB = [patternratio / posB.width / dasharray.toScale, -posB.height / 2];
        var gammaB = painter.lineAtlas.width / (dasharray.toScale * posB.width * 256 * browser.devicePixelRatio) / 2;

        gl.uniform2fv(shader.u_patternscale_a, scaleA);
        gl.uniform1f(shader.u_tex_y_a, posA.y);
        gl.uniform2fv(shader.u_patternscale_b, scaleB);
        gl.uniform1f(shader.u_tex_y_b, posB.y);

        gl.uniform1i(shader.u_image, 0);
        gl.uniform1f(shader.u_sdfgamma, Math.max(gammaA, gammaB));
        gl.uniform1f(shader.u_mix, dasharray.t);

    } else if (image) {
        var imagePosA = painter.spriteAtlas.getPosition(image.from, true);
        var imagePosB = painter.spriteAtlas.getPosition(image.to, true);
        if (!imagePosA || !imagePosB) return;
        var factor = 8 / Math.pow(2, painter.transform.tileZoom - tile.zoom);

        painter.spriteAtlas.bind(gl, true);

        shader = painter.linepatternShader;
        gl.switchShader(shader, vtxMatrix, tile.exMatrix);

        gl.uniform2fv(shader.u_linewidth, [ outset, inset ]);
        gl.uniform1f(shader.u_ratio, ratio);
        gl.uniform1f(shader.u_blur, blur);

        gl.uniform2fv(shader.u_pattern_size_a, [imagePosA.size[0] * factor * image.fromScale, imagePosB.size[1] ]);
        gl.uniform2fv(shader.u_pattern_size_b, [imagePosB.size[0] * factor * image.toScale, imagePosB.size[1] ]);
        gl.uniform2fv(shader.u_pattern_tl_a, imagePosA.tl);
        gl.uniform2fv(shader.u_pattern_br_a, imagePosA.br);
        gl.uniform2fv(shader.u_pattern_tl_b, imagePosB.tl);
        gl.uniform2fv(shader.u_pattern_br_b, imagePosB.br);
        gl.uniform1f(shader.u_fade, image.t);
        gl.uniform1f(shader.u_opacity, layer.paint['line-opacity']);

    } else {
        shader = painter.lineShader;
        gl.switchShader(shader, vtxMatrix, tile.exMatrix);

        gl.uniform2fv(shader.u_linewidth, [ outset, inset ]);
        gl.uniform1f(shader.u_ratio, ratio);
        gl.uniform1f(shader.u_blur, blur);

        if (!elementGroups.colorBuffer[layer.id] && mapboxGLFunction.is(color)) {

            var colorFunction = mapboxGLFunction.interpolated(color);
            colorBuffer = elementGroups.colorBuffer[layer.id] = new Buffer();

            for (i = 0; i < elementGroups.groups.length; i++) {
                group = elementGroups.groups[i];
                for (var j = 0; j < group.vertexLength; j++) {
                    colorBuffer.resize();

                    var featureProperties = group.featureProperties[j];
                    var featureColor = colorFunction(tile.zoom, featureProperties);

                    var pos = colorBuffer.pos;
                    colorBuffer.ubytes[pos + 0] = featureColor[0] * 255;
                    colorBuffer.ubytes[pos + 1] = featureColor[1] * 255;
                    colorBuffer.ubytes[pos + 2] = featureColor[2] * 255;
                    colorBuffer.ubytes[pos + 3] = featureColor[3] * 255;

                    colorBuffer.pos += colorBuffer.itemSize;
                }
            }
        }
    }

    var element = tile.buffers.lineElement;
    element.bind(gl);

    var vertex = tile.buffers.lineVertex;
    var colorVtxOffset = 0;

    if (!mapboxGLFunction.is(color)) {
        gl.disableVertexAttribArray(shader.a_color);
    }

    for (i = 0; i < elementGroups.groups.length; i++) {
        group = elementGroups.groups[i];
        var vtxOffset = group.vertexStartIndex * vertex.itemSize;

        vertex.bind(gl);
        gl.vertexAttribPointer(shader.a_pos, 2, gl.SHORT, false, 8, vtxOffset + 0);
        gl.vertexAttribPointer(shader.a_data, 4, gl.BYTE, false, 8, vtxOffset + 4);

        if (mapboxGLFunction.is(color)) {
            colorBuffer = elementGroups.colorBuffer[layer.id];

            colorBuffer.bind(gl);
            gl.vertexAttribPointer(shader.a_color, 4, gl.UNSIGNED_BYTE, false, 4, colorVtxOffset);

            colorVtxOffset += group.vertexLength * 4;
        } else {
            gl.vertexAttrib4f(
                shader.a_color,
                color[0] * 255,
                color[1] * 255,
                color[2] * 255,
                color[3] * 255
            );
        }

        var count = group.elementLength * 3;
        var elementOffset = group.elementStartIndex * element.itemSize;
        gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, elementOffset);
        gl.enableVertexAttribArray(shader.a_color);
    }

};
