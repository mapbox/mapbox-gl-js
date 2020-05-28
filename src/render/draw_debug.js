// @flow

import DepthMode from '../gl/depth_mode';
import StencilMode from '../gl/stencil_mode';
import CullFaceMode from '../gl/cull_face_mode';
import {debugUniformValues} from './program/debug_program';
import Color from '../style-spec/util/color';
import ColorMode from '../gl/color_mode';
import browser from '../util/browser';

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type {OverscaledTileID} from '../source/tile_id';

export default drawDebug;

const topColor = new Color(1, 0, 0, 1);
const btmColor = new Color(0, 1, 0, 1);
const leftColor = new Color(0, 0, 1, 1);
const rightColor = new Color(1, 0, 1, 1);
const centerColor = new Color(0, 1, 1, 1);

export function drawDebugPadding(painter: Painter) {
    const padding = painter.transform.padding;
    const lineWidth = 3;
    // Top
    drawHorizontalLine(painter, painter.transform.height - (padding.top || 0), lineWidth, topColor);
    // Bottom
    drawHorizontalLine(painter, padding.bottom || 0, lineWidth, btmColor);
    // Left
    drawVerticalLine(painter, padding.left || 0, lineWidth, leftColor);
    // Right
    drawVerticalLine(painter, painter.transform.width - (padding.right || 0), lineWidth, rightColor);
    // Center
    const center = painter.transform.centerPoint;
    drawCrosshair(painter, center.x, painter.transform.height - center.y, centerColor);
}

function drawCrosshair(painter: Painter, x: number, y: number, color: Color) {
    const size = 20;
    const lineWidth = 2;
    //Vertical line
    drawDebugSSRect(painter, x - lineWidth / 2, y - size / 2, lineWidth, size, color);
    //Horizontal line
    drawDebugSSRect(painter, x - size / 2, y - lineWidth / 2, size, lineWidth, color);
}

function drawHorizontalLine(painter: Painter, y: number, lineWidth: number, color: Color) {
    drawDebugSSRect(painter, 0, y  + lineWidth / 2, painter.transform.width,  lineWidth, color);
}

function drawVerticalLine(painter: Painter, x: number, lineWidth: number, color: Color) {
    drawDebugSSRect(painter, x - lineWidth / 2, 0, lineWidth,  painter.transform.height, color);
}

function drawDebugSSRect(painter: Painter, x: number, y: number, width: number, height: number, color: Color) {
    const context = painter.context;
    const gl = context.gl;

    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(x * browser.devicePixelRatio, y * browser.devicePixelRatio, width * browser.devicePixelRatio, height * browser.devicePixelRatio);
    context.clear({color});
    gl.disable(gl.SCISSOR_TEST);
}

function drawDebug(painter: Painter, sourceCache: SourceCache, coords: Array<OverscaledTileID>) {
    for (let i = 0; i < coords.length; i++) {
        drawDebugTile(painter, sourceCache, coords[i]);
    }
}

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
    const scaleRatio = (512 / Math.min(tileSize, 512) * (coord.overscaledZ / painter.transform.zoom)) * 0.5;
    let tileIdText = coord.canonical.toString();
    if (coord.overscaledZ !== coord.canonical.z) {
        tileIdText += ` => ${coord.overscaledZ}`;
    }
    const tileLabel = `${tileIdText} ${tileSizeKb}kb`;
    drawTextToOverlay(painter, tileLabel);

    program.draw(context, gl.TRIANGLES, depthMode, stencilMode, ColorMode.alphaBlended, CullFaceMode.disabled,
        debugUniformValues(posMatrix, Color.transparent, scaleRatio), id,
        painter.debugBuffer, painter.quadTriangleIndexBuffer, painter.debugSegments);
}

function drawTextToOverlay(painter: Painter, text: string) {
    painter.initDebugOverlayCanvas();
    const canvas = painter.debugOverlayCanvas;
    const gl = painter.context.gl;
    const ctx2d = painter.debugOverlayCanvas.getContext('2d');
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);

    ctx2d.shadowColor = 'white';
    ctx2d.shadowBlur = 2;
    ctx2d.lineWidth = 1.5;
    ctx2d.strokeStyle = 'white';
    ctx2d.textBaseline = 'top';
    ctx2d.font = `bold ${36}px Open Sans, sans-serif`;
    ctx2d.fillText(text, 5, 5);
    ctx2d.strokeText(text, 5, 5);

    painter.debugOverlayTexture.update(canvas);
    painter.debugOverlayTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
}
