'use strict';

const util = require('../util/util');
const browser = require('../util/browser');
const drawCollisionDebug = require('./draw_collision_debug');
const pixelsToTileUnits = require('../source/pixels_to_tile_units');

module.exports = drawSymbols;

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
        layer.layout['icon-rotation-alignment']
    );

    drawLayerSymbols(painter, sourceCache, layer, coords, true,
        layer.paint['text-translate'],
        layer.paint['text-translate-anchor'],
        layer.layout['text-rotation-alignment'],
        layer.layout['text-pitch-alignment']
    );

    if (sourceCache.map.showCollisionBoxes) {
        drawCollisionDebug(painter, sourceCache, layer, coords);
    }
}

function drawLayerSymbols(painter, sourceCache, layer, coords, isText, translate, translateAnchor,
        rotationAlignment, pitchAlignment) {

    if (!isText && painter.style.sprite && !painter.style.sprite.loaded())
        return;

    const gl = painter.gl;

    const rotateWithMap = rotationAlignment === 'map';
    const pitchWithMap = pitchAlignment === 'map';

    const depthOn = pitchWithMap;

    if (depthOn) {
        gl.enable(gl.DEPTH_TEST);
    } else {
        gl.disable(gl.DEPTH_TEST);
    }

    let program, prevFontstack;

    for (const coord of coords) {
        const tile = sourceCache.getTile(coord);
        const bucket = tile.getBucket(layer);
        if (!bucket) continue;
        const buffers = isText ? bucket.buffers.glyph : bucket.buffers.icon;
        if (!buffers || !buffers.segments.length) continue;
        const layerData = buffers.layerData[layer.id];
        const programConfiguration = layerData.programConfiguration;

        const isSDF = isText || bucket.sdfIcons;

        const sizeStopZoomLevels = isText ? bucket.textSizeCoveringZoomStops : bucket.iconSizeCoveringZoomStops;
        const layoutSize = isText ? bucket.layoutTextSize : bucket.layoutIconSize;

        if (!program || bucket.fontstack !== prevFontstack) {
            program = painter.useProgram(isSDF ? 'symbolSDF' : 'symbolIcon', programConfiguration);
            programConfiguration.setUniforms(gl, program, layer, {zoom: painter.transform.zoom});

            setSymbolDrawState(program, painter, layer, coord.z, isText, isSDF, rotateWithMap, pitchWithMap, bucket.fontstack, bucket.iconsNeedLinear, sizeStopZoomLevels, layoutSize);
        }

        painter.enableTileClippingMask(coord);

        gl.uniformMatrix4fv(program.u_matrix, false,
                painter.translatePosMatrix(coord.posMatrix, tile, translate, translateAnchor));

        drawTileSymbols(program, programConfiguration, painter, layer, tile, buffers, isText, isSDF,
                pitchWithMap);

        prevFontstack = bucket.fontstack;
    }

    if (!depthOn) gl.enable(gl.DEPTH_TEST);
}

function setSymbolDrawState(program, painter, layer, tileZoom, isText, isSDF, rotateWithMap, pitchWithMap, fontstack, iconsNeedLinear, sizeStopZoomLevels, layoutSize) {

    const gl = painter.gl;
    const tr = painter.transform;

    gl.uniform1i(program.u_rotate_with_map, rotateWithMap);
    gl.uniform1i(program.u_pitch_with_map, pitchWithMap);

    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(program.u_texture, 0);

    gl.uniform1f(program.u_is_text, isText ? 1 : 0);

    if (isText) {
        // use the fonstack used when parsing the tile, not the fontstack
        // at the current zoom level (layout['text-font']).
        const glyphAtlas = fontstack && painter.glyphSource.getGlyphAtlas(fontstack);
        if (!glyphAtlas) return;

        glyphAtlas.updateTexture(gl);
        gl.uniform2f(program.u_texsize, glyphAtlas.width / 4, glyphAtlas.height / 4);
    } else {
        const mapMoving = painter.options.rotating || painter.options.zooming;
        const iconSizeScaled = !layer.isLayoutValueFeatureConstant('icon-size') ||
            !layer.isLayoutValueZoomConstant('icon-size') ||
            layer.getLayoutValue('icon-size', { zoom: tr.zoom }) !== 1;
        const iconScaled = iconSizeScaled || browser.devicePixelRatio !== painter.spriteAtlas.pixelRatio || iconsNeedLinear;
        const iconTransformed = pitchWithMap || tr.pitch;
        painter.spriteAtlas.bind(gl, isSDF || mapMoving || iconScaled || iconTransformed);
        gl.uniform2f(program.u_texsize, painter.spriteAtlas.width / 4, painter.spriteAtlas.height / 4);
    }

    gl.activeTexture(gl.TEXTURE1);
    painter.frameHistory.bind(gl);
    gl.uniform1i(program.u_fadetexture, 1);

    gl.uniform1f(program.u_zoom, tr.zoom);

    gl.uniform1f(program.u_pitch, tr.pitch / 360 * 2 * Math.PI);
    gl.uniform1f(program.u_bearing, tr.bearing / 360 * 2 * Math.PI);
    gl.uniform1f(program.u_aspect_ratio, tr.width / tr.height);

    const sizeProp = isText ? 'text-size' : 'icon-size';

    const isFeatureConstant = layer.isLayoutValueFeatureConstant(sizeProp);
    const isZoomConstant = layer.isLayoutValueZoomConstant(sizeProp);
    gl.uniform1i(program.u_is_size_zoom_constant, isZoomConstant ? 1 : 0);
    gl.uniform1i(program.u_is_size_feature_constant, isFeatureConstant ? 1 : 0);

    if (!isZoomConstant && !isFeatureConstant) {
        // composite function
        const lower = sizeStopZoomLevels[0];
        const upper = sizeStopZoomLevels[1];
        const t = (tr.zoom - lower) / (upper - lower);
        gl.uniform1f(program.u_size_t, util.clamp(t, 0, 1));
    } else if (isFeatureConstant && !isZoomConstant) {
        // Even though we could get the exact value of the camera function at
        // z = tr.zoom, we intentionally do not: instead, we interpolate between
        // the camera function values at z = tileZoom and z = tileZoom + 1
        // to be consistent with this restriction on composite functions
        const lowerZoom = sizeStopZoomLevels[0];
        const upperZoom = sizeStopZoomLevels[1];
        const lowerValue = layer.getLayoutValue(sizeProp, {zoom: lowerZoom});
        const upperValue = layer.getLayoutValue(sizeProp, {zoom: upperZoom});
        const t = util.clamp((tr.zoom - lowerZoom) / (upperZoom - lowerZoom), 0, 1);
        const size = lowerValue + (upperValue - lowerValue) * t;
        gl.uniform1f(program.u_size, size);
        gl.uniform1f(program.u_layout_size, layoutSize);
    } else if (isFeatureConstant && isZoomConstant) {
        const size = layer.getLayoutValue(sizeProp, {zoom: tr.zoom});
        gl.uniform1f(program.u_size, size);
    }
}

function drawTileSymbols(program, programConfiguration, painter, layer, tile, buffers, isText, isSDF, pitchWithMap) {

    const gl = painter.gl;
    const tr = painter.transform;

    if (pitchWithMap) {
        const s = pixelsToTileUnits(tile, 1, tr.zoom);
        gl.uniform2f(program.u_extrude_scale, s, s);
    } else {
        const s = tr.cameraToCenterDistance;
        gl.uniform2f(program.u_extrude_scale,
            tr.pixelsToGLUnits[0] * s,
            tr.pixelsToGLUnits[1] * s);
    }

    if (isSDF) {
        const haloWidthProperty = `${isText ? 'text' : 'icon'}-halo-width`;
        const hasHalo = !layer.isPaintValueFeatureConstant(haloWidthProperty) || layer.paint[haloWidthProperty];
        const gammaScale = (pitchWithMap ? Math.cos(tr._pitch) : 1) * tr.cameraToCenterDistance;
        gl.uniform1f(program.u_gamma_scale, gammaScale);

        if (hasHalo) { // Draw halo underneath the text.
            gl.uniform1f(program.u_is_halo, 1);
            drawSymbolElements(buffers, layer, gl, program);
        }

        gl.uniform1f(program.u_is_halo, 0);
    }

    drawSymbolElements(buffers, layer, gl, program);
}

function drawSymbolElements(buffers, layer, gl, program) {
    const layerData = buffers.layerData[layer.id];
    const paintVertexBuffer = layerData && layerData.paintVertexBuffer;

    for (const segment of buffers.segments) {
        segment.vaos[layer.id].bind(gl, program, buffers.layoutVertexBuffer, buffers.elementBuffer, paintVertexBuffer, segment.vertexOffset);
        gl.drawElements(gl.TRIANGLES, segment.primitiveLength * 3, gl.UNSIGNED_SHORT, segment.primitiveOffset * 3 * 2);
    }
}
