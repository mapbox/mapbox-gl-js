'use strict';

var mat4 = require('gl-matrix').mat4;

var browser = require('../util/browser');
var drawCollisionDebug = require('./draw_collision_debug');
var util = require('../util/util');
var pixelsToTileUnits = require('../source/pixels_to_tile_units');


module.exports = drawSymbols;

function drawSymbols(painter, source, layer, coords) {
    if (painter.isOpaquePass) return;

    var drawAcrossEdges = !(layer.layout['text-allow-overlap'] || layer.layout['icon-allow-overlap'] ||
        layer.layout['text-ignore-placement'] || layer.layout['icon-ignore-placement']);

    var gl = painter.gl;

    // Disable the stencil test so that labels aren't clipped to tile boundaries.
    //
    // Layers with features that may be drawn overlapping aren't clipped. These
    // layers are sorted in the y direction, and to draw the correct ordering near
    // tile edges the icons are included in both tiles and clipped when drawing.
    if (drawAcrossEdges) {
        gl.disable(gl.STENCIL_TEST);
    } else {
        gl.enable(gl.STENCIL_TEST);
    }

    painter.setDepthSublayer(0);
    painter.depthMask(false);
    gl.disable(gl.DEPTH_TEST);

    var tile, elementGroups, bucket;

    for (var i = 0; i < coords.length; i++) {
        tile = source.getTile(coords[i]);
        bucket = tile.getBucket(layer);
        if (!bucket) continue;
        elementGroups = bucket.elementGroups;
        if (!elementGroups.icon.length) continue;

        painter.enableTileClippingMask(coords[i]);
        drawSymbol(painter, layer, coords[i].posMatrix, tile, bucket, elementGroups.icon, 'icon', elementGroups.sdfIcons, elementGroups.iconsNeedLinear);
    }

    for (var j = 0; j < coords.length; j++) {
        tile = source.getTile(coords[j]);
        bucket = tile.getBucket(layer);
        if (!bucket) continue;
        elementGroups = bucket.elementGroups;
        if (!elementGroups.glyph.length) continue;

        painter.enableTileClippingMask(coords[j]);
        drawSymbol(painter, layer, coords[j].posMatrix, tile, bucket, elementGroups.glyph, 'text', true, false);
    }

    gl.enable(gl.DEPTH_TEST);

    drawCollisionDebug(painter, source, layer, coords);
}

var defaultSizes = {
    icon: 1,
    text: 24
};

function drawSymbol(painter, layer, posMatrix, tile, bucket, elementGroups, prefix, sdf, iconsNeedLinear) {
    var gl = painter.gl;

    posMatrix = painter.translatePosMatrix(posMatrix, tile, layer.paint[prefix + '-translate'], layer.paint[prefix + '-translate-anchor']);

    var tr = painter.transform;
    var alignedWithMap = layer.layout[prefix + '-rotation-alignment'] === 'map';
    var skewed = alignedWithMap;
    var exMatrix, s, gammaScale;

    if (skewed) {
        exMatrix = mat4.create();
        s = pixelsToTileUnits(tile, 1, painter.transform.zoom);
        gammaScale = 1 / Math.cos(tr._pitch);
    } else {
        exMatrix = mat4.clone(painter.transform.exMatrix);
        s = painter.transform.altitude;
        gammaScale = 1;
    }
    mat4.scale(exMatrix, exMatrix, [s, s, 1]);

    var fontSize = layer.layout[prefix + '-size'];
    var fontScale = fontSize / defaultSizes[prefix];
    mat4.scale(exMatrix, exMatrix, [ fontScale, fontScale, 1 ]);

    // calculate how much longer the real world distance is at the top of the screen
    // than at the middle of the screen.
    var topedgelength = Math.sqrt(tr.height * tr.height / 4  * (1 + tr.altitude * tr.altitude));
    var x = tr.height / 2 * Math.tan(tr._pitch);
    var extra = (topedgelength + x) / topedgelength - 1;

    var text = prefix === 'text';
    var vertex, elements;

    if (!text && !painter.style.sprite.loaded())
        return;

    gl.activeTexture(gl.TEXTURE0);

    var program = painter.useProgram(sdf ? 'sdf' : 'icon', posMatrix, exMatrix);

    var texsize;
    if (text) {
        // use the fonstack used when parsing the tile, not the fontstack
        // at the current zoom level (layout['text-font']).
        var fontstack = elementGroups.fontstack;
        var glyphAtlas = fontstack && painter.glyphSource.getGlyphAtlas(fontstack);
        if (!glyphAtlas) return;

        glyphAtlas.updateTexture(gl);
        vertex = bucket.buffers.glyphVertex;
        elements = bucket.buffers.glyphElement;
        texsize = [glyphAtlas.width / 4, glyphAtlas.height / 4];
    } else {
        var mapMoving = painter.options.rotating || painter.options.zooming;
        var iconScaled = fontScale !== 1 || browser.devicePixelRatio !== painter.spriteAtlas.pixelRatio || iconsNeedLinear;
        var iconTransformed = alignedWithMap || painter.transform.pitch;
        painter.spriteAtlas.bind(gl, sdf || mapMoving || iconScaled || iconTransformed);
        vertex = bucket.buffers.iconVertex;
        elements = bucket.buffers.iconElement;
        texsize = [painter.spriteAtlas.width / 4, painter.spriteAtlas.height / 4];
    }

    gl.uniform1i(program.u_texture, 0);
    gl.uniform2fv(program.u_texsize, texsize);
    gl.uniform1i(program.u_skewed, skewed);
    gl.uniform1f(program.u_extra, extra);

    // adjust min/max zooms for variable font sizes
    var zoomAdjust = Math.log(fontSize / elementGroups.adjustedSize) / Math.LN2 || 0;


    gl.uniform1f(program.u_zoom, (painter.transform.zoom - zoomAdjust) * 10); // current zoom level

    gl.activeTexture(gl.TEXTURE1);
    painter.frameHistory.bind(gl);
    gl.uniform1i(program.u_fadetexture, 1);

    var group, offset, count, elementOffset;

    elements.bind(gl);

    if (sdf) {
        var sdfPx = 8;
        var blurOffset = 1.19;
        var haloOffset = 6;
        var gamma = 0.105 * defaultSizes[prefix] / fontSize / browser.devicePixelRatio;

        if (layer.paint[prefix + '-halo-width']) {
            var haloColor = util.premultiply(layer.paint[prefix + '-halo-color'], layer.paint[prefix + '-opacity']);

            // Draw halo underneath the text.
            gl.uniform1f(program.u_gamma, (layer.paint[prefix + '-halo-blur'] * blurOffset / fontScale / sdfPx + gamma) * gammaScale);
            gl.uniform4fv(program.u_color, haloColor);
            gl.uniform1f(program.u_buffer, (haloOffset - layer.paint[prefix + '-halo-width'] / fontScale) / sdfPx);

            for (var j = 0; j < elementGroups.length; j++) {
                group = elementGroups[j];
                offset = group.vertexStartIndex * vertex.itemSize;
                vertex.bind(gl);
                vertex.setAttribPointers(gl, program, offset);

                count = group.elementLength * 3;
                elementOffset = group.elementStartIndex * elements.itemSize;
                gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, elementOffset);
            }
        }

        var color = util.premultiply(layer.paint[prefix + '-color'], layer.paint[prefix + '-opacity']);
        gl.uniform1f(program.u_gamma, gamma * gammaScale);
        gl.uniform4fv(program.u_color, color);
        gl.uniform1f(program.u_buffer, (256 - 64) / 256);

        for (var i = 0; i < elementGroups.length; i++) {
            group = elementGroups[i];
            offset = group.vertexStartIndex * vertex.itemSize;
            vertex.bind(gl);
            vertex.setAttribPointers(gl, program, offset);

            count = group.elementLength * 3;
            elementOffset = group.elementStartIndex * elements.itemSize;
            gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, elementOffset);
        }

    } else {
        gl.uniform1f(program.u_opacity, layer.paint['icon-opacity']);
        for (var k = 0; k < elementGroups.length; k++) {
            group = elementGroups[k];
            offset = group.vertexStartIndex * vertex.itemSize;
            vertex.bind(gl);
            vertex.setAttribPointers(gl, program, offset);

            count = group.elementLength * 3;
            elementOffset = group.elementStartIndex * elements.itemSize;
            gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, elementOffset);
        }
    }
}
