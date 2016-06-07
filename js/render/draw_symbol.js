'use strict';

var browser = require('../util/browser');
var drawCollisionDebug = require('./draw_collision_debug');
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

    drawLayerSymbols(painter, source, layer, coords, false,
            layer.paint['icon-translate'],
            layer.paint['icon-translate-anchor'],
            layer.layout['icon-rotation-alignment'],
            layer.layout['icon-size'],
            layer.paint['icon-halo-width'],
            layer.paint['icon-halo-color'],
            layer.paint['icon-halo-blur'],
            layer.paint['icon-opacity'],
            layer.paint['icon-color']);

    drawLayerSymbols(painter, source, layer, coords, true,
            layer.paint['text-translate'],
            layer.paint['text-translate-anchor'],
            layer.layout['text-rotation-alignment'],
            layer.layout['text-size'],
            layer.paint['text-halo-width'],
            layer.paint['text-halo-color'],
            layer.paint['text-halo-blur'],
            layer.paint['text-opacity'],
            layer.paint['text-color']);

    gl.enable(gl.DEPTH_TEST);

    drawCollisionDebug(painter, source, layer, coords);
}

function drawLayerSymbols(painter, source, layer, coords, isText,
        translate,
        translateAnchor,
        rotationAlignment,
        size,
        haloWidth,
        haloColor,
        haloBlur,
        opacity,
        color) {

    for (var j = 0; j < coords.length; j++) {
        var tile = source.getTile(coords[j]);
        var bucket = tile.getBucket(layer);
        if (!bucket) continue;
        var bothBufferGroups = bucket.bufferGroups;
        var bufferGroups = isText ? bothBufferGroups.glyph : bothBufferGroups.icon;
        if (!bufferGroups.length) continue;

        painter.enableTileClippingMask(coords[j]);
        drawSymbol(painter, layer, coords[j].posMatrix, tile, bucket, bufferGroups, isText,
                isText || bucket.sdfIcons, !isText && bucket.iconsNeedLinear,
                isText ? bucket.adjustedTextSize : bucket.adjustedIconSize, bucket.fontstack,
                translate,
                translateAnchor,
                rotationAlignment,
                size,
                haloWidth,
                haloColor,
                haloBlur,
                opacity,
                color);
    }
}

function drawSymbol(painter, layer, posMatrix, tile, bucket, bufferGroups, isText, sdf, iconsNeedLinear, adjustedSize, fontstack,
        translate,
        translateAnchor,
        rotationAlignment,
        size,
        haloWidth,
        haloColor,
        haloBlur,
        opacity,
        color) {
    var gl = painter.gl;
    var tr = painter.transform;
    var alignedWithMap = rotationAlignment === 'map';

    var defaultSize = isText ? 24 : 1;
    var fontScale = size / defaultSize;

    var extrudeScale, s, gammaScale;
    if (alignedWithMap) {
        s = pixelsToTileUnits(tile, 1, painter.transform.zoom) * fontScale;
        gammaScale = 1 / Math.cos(tr._pitch);
        extrudeScale = [s, s];
    } else {
        s = painter.transform.altitude * fontScale;
        gammaScale = 1;
        extrudeScale = [ tr.pixelsToGLUnits[0] * s, tr.pixelsToGLUnits[1] * s];
    }

    if (!isText && !painter.style.sprite.loaded())
        return;

    var program = painter.useProgram(sdf ? 'sdf' : 'icon');
    gl.uniformMatrix4fv(program.u_matrix, false, painter.translatePosMatrix(posMatrix, tile, translate, translateAnchor));
    gl.uniform1i(program.u_skewed, alignedWithMap);
    gl.uniform2fv(program.u_extrude_scale, extrudeScale);

    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(program.u_texture, 0);

    if (isText) {
        // use the fonstack used when parsing the tile, not the fontstack
        // at the current zoom level (layout['text-font']).
        var glyphAtlas = fontstack && painter.glyphSource.getGlyphAtlas(fontstack);
        if (!glyphAtlas) return;

        glyphAtlas.updateTexture(gl);
        gl.uniform2f(program.u_texsize, glyphAtlas.width / 4, glyphAtlas.height / 4);
    } else {
        var mapMoving = painter.options.rotating || painter.options.zooming;
        var iconScaled = fontScale !== 1 || browser.devicePixelRatio !== painter.spriteAtlas.pixelRatio || iconsNeedLinear;
        var iconTransformed = alignedWithMap || painter.transform.pitch;
        painter.spriteAtlas.bind(gl, sdf || mapMoving || iconScaled || iconTransformed);
        gl.uniform2f(program.u_texsize, painter.spriteAtlas.width / 4, painter.spriteAtlas.height / 4);
    }

    // adjust min/max zooms for variable font sizes
    var zoomAdjust = Math.log(size / adjustedSize) / Math.LN2 || 0;
    gl.uniform1f(program.u_zoom, (painter.transform.zoom - zoomAdjust) * 10); // current zoom level

    gl.activeTexture(gl.TEXTURE1);
    painter.frameHistory.bind(gl);
    gl.uniform1i(program.u_fadetexture, 1);

    var group;

    if (sdf) {
        var sdfPx = 8;
        var blurOffset = 1.19;
        var haloOffset = 6;
        var gamma = 0.105 * defaultSize / size / browser.devicePixelRatio;

        if (haloWidth) {
            // Draw halo underneath the text.
            gl.uniform1f(program.u_gamma, (haloBlur * blurOffset / fontScale / sdfPx + gamma) * gammaScale);
            gl.uniform4fv(program.u_color, haloColor);
            gl.uniform1f(program.u_opacity, opacity);
            gl.uniform1f(program.u_buffer, (haloOffset - haloWidth / fontScale) / sdfPx);

            for (var j = 0; j < bufferGroups.length; j++) {
                group = bufferGroups[j];
                group.vaos[layer.id].bind(gl, program, group.layout.vertex, group.layout.element);
                gl.drawElements(gl.TRIANGLES, group.layout.element.length * 3, gl.UNSIGNED_SHORT, 0);
            }
        }

        gl.uniform1f(program.u_gamma, gamma * gammaScale);
        gl.uniform4fv(program.u_color, color);
        gl.uniform1f(program.u_opacity, opacity);
        gl.uniform1f(program.u_buffer, (256 - 64) / 256);

        for (var i = 0; i < bufferGroups.length; i++) {
            group = bufferGroups[i];
            group.vaos[layer.id].bind(gl, program, group.layout.vertex, group.layout.element);
            gl.drawElements(gl.TRIANGLES, group.layout.element.length * 3, gl.UNSIGNED_SHORT, 0);
        }

    } else {
        gl.uniform1f(program.u_opacity, opacity);
        for (var k = 0; k < bufferGroups.length; k++) {
            group = bufferGroups[k];
            group.vaos[layer.id].bind(gl, program, group.layout.vertex, group.layout.element);
            gl.drawElements(gl.TRIANGLES, group.layout.element.length * 3, gl.UNSIGNED_SHORT, 0);
        }
    }
}
