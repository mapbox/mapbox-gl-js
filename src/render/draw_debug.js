// @flow

import DepthMode from '../gl/depth_mode';
import StencilMode from '../gl/stencil_mode';
import CullFaceMode from '../gl/cull_face_mode';
import {debugUniformValues} from './program/debug_program';
import Color from '../style-spec/util/color';
import ColorMode from '../gl/color_mode';

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type {OverscaledTileID} from '../source/tile_id';

export default drawDebug;

function drawDebug(painter: Painter, sourceCache: SourceCache, coords: Array<OverscaledTileID>) {
    for (let i = 0; i < coords.length; i++) {
        drawDebugTile(painter, sourceCache, coords[i]);
    }
}

let emptyTexture;
let textTexture;

function drawDebugTile(painter, sourceCache, coord: OverscaledTileID) {
    const context = painter.context;
    const gl = context.gl;

    const posMatrix = coord.posMatrix;
    const program = painter.useProgram('debug');

    const depthMode = DepthMode.disabled;
    const stencilMode = StencilMode.disabled;
    const colorMode = painter.colorModeForRenderPass();
    const id = '$debug';

    context.activeTexture.set(gl.TEXTURE0);
    // Bind the empty texture for drawing outlines
    painter.emptyTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);

    program.draw(context, gl.LINE_STRIP, depthMode, stencilMode, colorMode, CullFaceMode.disabled,
        debugUniformValues(posMatrix, Color.red), id,
        painter.debugBuffer, painter.tileBorderIndexBuffer, painter.debugSegments);

    const tileRawData = sourceCache.getTileByID(coord.key).latestRawTileData;
    const tileByteLength = (tileRawData && tileRawData.byteLength) || 0;
    const tileSizeKb = Math.floor(tileByteLength / 1024);
    const tileSize = sourceCache.getTile(coord).tileSize;
    const scaleRatio = 512 / Math.min(tileSize, 512);
    let tileIdText = coord.canonical.toString();
    if (coord.overscaledZ !== coord.canonical.z) {
        tileIdText += ` => ${coord.overscaledZ}`;
    }
    const tileLabel = `${tileIdText} ${tileSizeKb}kb`;
    drawTextToOverlay(painter, tileLabel);

    program.draw(context, gl.TRIANGLES, depthMode, stencilMode, ColorMode.alphaBlended, CullFaceMode.disabled,
        debugUniformValues(posMatrix, Color.transparent), id,
        painter.debugBuffer, painter.quadTriangleIndexBuffer, painter.debugSegments);
}

function drawTextToOverlay(painter: Painter, text: string) {
    painter.initDebugOverlayCanvas();
    const canvas = painter.debugOverlayCanvas;
    const gl = painter.context.gl;
    const ctx2d = painter.debugOverlayCanvas.getContext('2d');
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);

    ctx2d.font='24px Arial';
    ctx2d.fillText(text, 50, 50);

    painter.debugOverlayTexture.update(canvas);
    painter.debugOverlayTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
}