
const drawCollisionDebug = require('./draw_collision_debug');
const pixelsToTileUnits = require('../source/pixels_to_tile_units');
const symbolProjection = require('../symbol/projection');
const symbolSize = require('../symbol/symbol_size');
const mat4 = require('@mapbox/gl-matrix').mat4;
const identityMat4 = mat4.identity(new Float32Array(16));

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
        layer.layout['icon-pitch-alignment'],
        layer.layout['icon-keep-upright']
    );

    drawLayerSymbols(painter, sourceCache, layer, coords, true,
        layer.paint['text-translate'],
        layer.paint['text-translate-anchor'],
        layer.layout['text-rotation-alignment'],
        layer.layout['text-pitch-alignment'],
        layer.layout['text-keep-upright']
    );

    if (sourceCache.map.showCollisionBoxes) {
        drawCollisionDebug(painter, sourceCache, layer, coords);
    }
}

function drawLayerSymbols(painter, sourceCache, layer, coords, isText, translate, translateAnchor,
    rotationAlignment, pitchAlignment, keepUpright) {

    if (!isText && painter.style.sprite && !painter.style.sprite.loaded())
        return;

    const gl = painter.gl;

    const rotateWithMap = rotationAlignment === 'map';
    const pitchWithMap = pitchAlignment === 'map';
    const alongLine = rotateWithMap && layer.layout['symbol-placement'] === 'line';
    // Line label rotation happens in `updateLineLabels`
    // Pitched point labels are automatically rotated by the labelPlaneMatrix projection
    // Unpitched point labels need to have their rotation applied after projection
    const rotateInShader = rotateWithMap && !pitchWithMap && !alongLine;

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

        const sizeData = isText ? bucket.textSizeData : bucket.iconSizeData;

        if (!program || bucket.fontstack !== prevFontstack) {
            program = painter.useProgram(isSDF ? 'symbolSDF' : 'symbolIcon', programConfiguration);
            programConfiguration.setUniforms(gl, program, layer, {zoom: painter.transform.zoom});

            setSymbolDrawState(program, painter, layer, coord.z, isText, isSDF, rotateInShader, pitchWithMap, bucket.fontstack, bucket.iconsNeedLinear, sizeData);
        }

        painter.enableTileClippingMask(coord);

        gl.uniformMatrix4fv(program.u_matrix, false, painter.translatePosMatrix(coord.posMatrix, tile, translate, translateAnchor));

        const s = pixelsToTileUnits(tile, 1, painter.transform.zoom);
        const labelPlaneMatrix = symbolProjection.getLabelPlaneMatrix(coord.posMatrix, pitchWithMap, rotateWithMap, painter.transform, s);
        const glCoordMatrix = symbolProjection.getGlCoordMatrix(coord.posMatrix, pitchWithMap, rotateWithMap, painter.transform, s);
        gl.uniformMatrix4fv(program.u_gl_coord_matrix, false, painter.translatePosMatrix(glCoordMatrix, tile, translate, translateAnchor, true));

        if (alongLine) {
            gl.uniformMatrix4fv(program.u_label_plane_matrix, false, identityMat4);
            symbolProjection.updateLineLabels(bucket, coord.posMatrix, painter, isText, labelPlaneMatrix, glCoordMatrix, pitchWithMap, keepUpright, s, layer);
        } else {
            gl.uniformMatrix4fv(program.u_label_plane_matrix, false, labelPlaneMatrix);
        }

        gl.uniform1f(program.u_collision_y_stretch, tile.collisionTile.yStretch);

        drawTileSymbols(program, programConfiguration, painter, layer, tile, buffers, isText, isSDF, pitchWithMap);

        prevFontstack = bucket.fontstack;
    }

    if (!depthOn) gl.enable(gl.DEPTH_TEST);
}

function setSymbolDrawState(program, painter, layer, tileZoom, isText, isSDF, rotateInShader, pitchWithMap, fontstack, iconsNeedLinear, sizeData) {

    const gl = painter.gl;
    const tr = painter.transform;

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
        gl.uniform2f(program.u_texsize, glyphAtlas.width, glyphAtlas.height);
    } else {
        const mapMoving = painter.options.rotating || painter.options.zooming;
        const iconSizeScaled = !layer.isLayoutValueFeatureConstant('icon-size') ||
            !layer.isLayoutValueZoomConstant('icon-size') ||
            layer.getLayoutValue('icon-size', { zoom: tr.zoom }) !== 1;
        const iconScaled = iconSizeScaled || iconsNeedLinear;
        const iconTransformed = pitchWithMap || tr.pitch;
        painter.spriteAtlas.bind(gl, isSDF || mapMoving || iconScaled || iconTransformed);
        gl.uniform2fv(program.u_texsize, painter.spriteAtlas.getPixelSize());
    }

    gl.activeTexture(gl.TEXTURE1);
    painter.frameHistory.bind(gl);
    gl.uniform1i(program.u_fadetexture, 1);

    gl.uniform1f(program.u_pitch, tr.pitch / 360 * 2 * Math.PI);

    gl.uniform1i(program.u_is_size_zoom_constant, sizeData.isZoomConstant ? 1 : 0);
    gl.uniform1i(program.u_is_size_feature_constant, sizeData.isFeatureConstant ? 1 : 0);

    gl.uniform1f(program.u_camera_to_center_distance, tr.cameraToCenterDistance);

    const size = symbolSize.evaluateSizeForZoom(sizeData, tr, layer, isText);
    if (size.uSizeT !== undefined) gl.uniform1f(program.u_size_t, size.uSizeT);
    if (size.uSize !== undefined) gl.uniform1f(program.u_size, size.uSize);

    gl.uniform1f(program.u_aspect_ratio, tr.width / tr.height);
    gl.uniform1i(program.u_rotate_symbol, rotateInShader);
}

function drawTileSymbols(program, programConfiguration, painter, layer, tile, buffers, isText, isSDF, pitchWithMap) {

    const gl = painter.gl;
    const tr = painter.transform;

    if (isSDF) {
        const haloWidthProperty = `${isText ? 'text' : 'icon'}-halo-width`;
        const hasHalo = !layer.isPaintValueFeatureConstant(haloWidthProperty) || layer.paint[haloWidthProperty];
        const gammaScale = (pitchWithMap ? Math.cos(tr._pitch) * tr.cameraToCenterDistance : 1);
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
        segment.vaos[layer.id].bind(gl, program, buffers.layoutVertexBuffer, buffers.elementBuffer, paintVertexBuffer, segment.vertexOffset, buffers.dynamicLayoutVertexBuffer);
        gl.drawElements(gl.TRIANGLES, segment.primitiveLength * 3, gl.UNSIGNED_SHORT, segment.primitiveOffset * 3 * 2);
    }
}
