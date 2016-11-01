'use strict';

const browser = require('../util/browser');
const drawCollisionDebug = require('./draw_collision_debug');
const pixelsToTileUnits = require('../source/pixels_to_tile_units');

module.exports = drawSymbols;

const sdfPx = 8;
const blurOffset = 1.19;
const haloOffset = 6;
const gamma = 0.105 / browser.devicePixelRatio;

function drawSymbols(painter, sourceCache, layer, coords) {
    if (painter.isOpaquePass) return;

    const drawAcrossEdges =
        !layer.layout['text-allow-overlap'] &&
        !layer.layout['icon-allow-overlap'] &&
        !layer.layout['text-ignore-placement'] &&
        !layer.layout['icon-ignore-placement'];

    const gl = painter.gl;

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

    drawLayerSymbols(painter, sourceCache, layer, coords, false,
        layer.paint['icon-translate'],
        layer.paint['icon-translate-anchor'],
        layer.layout['icon-rotation-alignment'],
        // icon-pitch-alignment is not yet implemented
        // and we simply inherit the rotation alignment
        layer.layout['icon-rotation-alignment'],
        layer.layout['icon-size'],
        layer.paint['icon-halo-width'],
        layer.paint['icon-halo-color'],
        layer.paint['icon-halo-blur'],
        layer.paint['icon-opacity'],
        layer.paint['icon-color']
    );

    drawLayerSymbols(painter, sourceCache, layer, coords, true,
        layer.paint['text-translate'],
        layer.paint['text-translate-anchor'],
        layer.layout['text-rotation-alignment'],
        layer.layout['text-pitch-alignment'],
        layer.layout['text-size'],
        layer.paint['text-halo-width'],
        layer.paint['text-halo-color'],
        layer.paint['text-halo-blur'],
        layer.paint['text-opacity'],
        layer.paint['text-color']
    );

    if (sourceCache.map.showCollisionBoxes) {
        drawCollisionDebug(painter, sourceCache, layer, coords);
    }
}

function drawLayerSymbols(painter, sourceCache, layer, coords, isText, translate, translateAnchor,
        rotationAlignment, pitchAlignment, size, haloWidth, haloColor, haloBlur, opacity, color) {

    if (!isText && painter.style.sprite && !painter.style.sprite.loaded())
        return;

    const gl = painter.gl;

    const rotateWithMap = rotationAlignment === 'map';
    const pitchWithMap = pitchAlignment === 'map';

    if (pitchWithMap) {
        gl.enable(gl.DEPTH_TEST);
    } else {
        gl.disable(gl.DEPTH_TEST);
    }

    let program;

    for (const coord of coords) {
        const tile = sourceCache.getTile(coord);
        const bucket = tile.getBucket(layer);
        if (!bucket) continue;
        const buffers = isText ? bucket.buffers.glyph : bucket.buffers.icon;
        if (!buffers.segments.length) continue;

        const isSDF = isText || bucket.sdfIcons;

        if (!program) {
            program = painter.useProgram(isSDF ? 'symbolSDF' : 'symbolIcon');

            setSymbolDrawState(program, painter, isText, isSDF, rotateWithMap, pitchWithMap, bucket.fontstack, size,
                    bucket.iconsNeedLinear, isText ? bucket.adjustedTextSize : bucket.adjustedIconSize, opacity);
        }

        painter.enableTileClippingMask(coord);

        gl.uniformMatrix4fv(program.u_matrix, false,
                painter.translatePosMatrix(coord.posMatrix, tile, translate, translateAnchor));

        drawTileSymbols(program, painter, layer, tile, buffers, isText, isSDF,
                pitchWithMap, size, haloWidth, haloColor, haloBlur, color);
    }
}

function setSymbolDrawState(program, painter, isText, isSDF, rotateWithMap, pitchWithMap, fontstack, size,
        iconsNeedLinear, adjustedSize, opacity) {

    const gl = painter.gl;
    const tr = painter.transform;

    gl.uniform1i(program.u_rotate_with_map, rotateWithMap);
    gl.uniform1i(program.u_pitch_with_map, pitchWithMap);

    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(program.u_texture, 0);

    if (isText) {
        // use the fonstack used when parsing the tile, not the fontstack
        // at the current zoom level (layout['text-font']).
        const glyphAtlas = fontstack && painter.glyphSource.getGlyphAtlas(fontstack);
        if (!glyphAtlas) return;

        glyphAtlas.updateTexture(gl);
        gl.uniform2f(program.u_texsize, glyphAtlas.width / 4, glyphAtlas.height / 4);
    } else {
        const mapMoving = painter.options.rotating || painter.options.zooming;
        const iconScaled = size !== 1 || browser.devicePixelRatio !== painter.spriteAtlas.pixelRatio || iconsNeedLinear;
        const iconTransformed = pitchWithMap || tr.pitch;
        painter.spriteAtlas.bind(gl, isSDF || mapMoving || iconScaled || iconTransformed);
        gl.uniform2f(program.u_texsize, painter.spriteAtlas.width / 4, painter.spriteAtlas.height / 4);
    }

    gl.activeTexture(gl.TEXTURE1);
    painter.frameHistory.bind(gl);
    gl.uniform1i(program.u_fadetexture, 1);

    // adjust min/max zooms for variable font sizes
    const zoomAdjust = Math.log(size / adjustedSize) / Math.LN2 || 0;
    gl.uniform1f(program.u_zoom, (tr.zoom - zoomAdjust) * 10); // current zoom level

    gl.uniform1f(program.u_pitch, tr.pitch / 360 * 2 * Math.PI);
    gl.uniform1f(program.u_bearing, tr.bearing / 360 * 2 * Math.PI);
    gl.uniform1f(program.u_aspect_ratio, tr.width / tr.height);

    gl.uniform1f(program.u_opacity, opacity);
}

function drawTileSymbols(program, painter, layer, tile, buffers, isText, isSDF,
        pitchWithMap, size, haloWidth, haloColor, haloBlur, color) {

    const gl = painter.gl;
    const tr = painter.transform;

    const fontScale = size / (isText ? 24 : 1);

    if (pitchWithMap) {
        const s = pixelsToTileUnits(tile, fontScale, tr.zoom);
        gl.uniform2f(program.u_extrude_scale, s, s);
    } else {
        const s = tr.altitude * fontScale;
        gl.uniform2f(program.u_extrude_scale, tr.pixelsToGLUnits[0] * s, tr.pixelsToGLUnits[1] * s);
    }

    if (isSDF) {
        const gammaScale = fontScale * (pitchWithMap ? Math.cos(tr._pitch) : 1);

        if (haloWidth) { // Draw halo underneath the text.
            gl.uniform1f(program.u_gamma, (haloBlur * blurOffset / sdfPx + gamma) / gammaScale);
            gl.uniform4fv(program.u_color, haloColor);
            gl.uniform1f(program.u_buffer, (haloOffset - haloWidth / fontScale) / sdfPx);

            drawSymbolElements(buffers, layer, gl, program);
        }

        gl.uniform1f(program.u_gamma, gamma / gammaScale);
        gl.uniform4fv(program.u_color, color);
        gl.uniform1f(program.u_buffer, (256 - 64) / 256);
    }

    drawSymbolElements(buffers, layer, gl, program);
}

function drawSymbolElements(buffers, layer, gl, program) {
    for (const segment of buffers.segments) {
        segment.vaos[layer.id].bind(gl, program, buffers.layoutVertexBuffer, buffers.elementBuffer, null, segment.vertexOffset);
        gl.drawElements(gl.TRIANGLES, segment.primitiveLength * 3, gl.UNSIGNED_SHORT, segment.primitiveOffset * 3 * 2);
    }
}
