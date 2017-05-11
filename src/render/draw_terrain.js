'use strict';
const mat4 = require('gl-matrix').mat4;
const EXTENT = require('../data/extent');

module.exports = drawTerrain;

//size of raster terrain tile
const TERRAIN_TILE_WIDTH = 256;
const TERRAIN_TILE_HEIGHT = 256;
const DEG2RAD = Math.PI / 180.0;


function drawTerrain(painter, sourceCache, layer, coords) {
    if (painter.isOpaquePass) return;

    const gl = painter.gl;
    gl.disable(gl.STENCIL_TEST);
    gl.enable(gl.DEPTH_TEST);
    painter.depthMask(true);

    // Change depth function to prevent double drawing in areas where tiles overlap.
    gl.depthFunc(gl.LESS);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    for (const coord of coords) {

        const tile = sourceCache.getTile(coord);
        if (!tile.texture) {
            prepareTerrain(painter, tile, layer);
        }

        tile.texture.render(tile, layer);
    }
}

// TODO create OffscreenTexture class for extrusions + terrain
// preprocessing ?
class TerrainTexture {
    constructor (gl, painter, layer) {
        this.gl = gl;
        this.width = TERRAIN_TILE_WIDTH;
        this.height = TERRAIN_TILE_HEIGHT;
        this.painter = painter;
        this.layer = layer;

        gl.activeTexture(gl.TEXTURE0);
        this.texture = gl.createTexture();

        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        this.texture.width = this.width;
        this.texture.height = this.height;

        this.fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
        gl.viewport(0, 0, this.width, this.height);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
    }

    render(tile, layer) {
        const gl = this.painter.gl;
        const program = this.painter.useProgram('terrain');
        const posMatrix = this.painter.transform.calculatePosMatrix(tile.coord);
        const azimuth = (-layer.paint["terrain-illumination-direction"] - 90) * DEG2RAD;

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);

        gl.uniformMatrix4fv(program.u_matrix, false, posMatrix);
        gl.uniform1i(program.u_image, 0);
        gl.uniform1i(program.u_mode, 0);
        gl.uniform2fv(program.u_dimension, [256, 256]);
        gl.uniform1f(program.u_zoom, tile.coord.z);
        gl.uniform1f(program.u_azimuth, azimuth);
        gl.uniform1f(program.u_zenith, 60 * DEG2RAD);
        gl.uniform1f(program.u_mipmap, 0);
        gl.uniform1f(program.u_exaggeration, layer.paint["terrain-exaggeration"]);
        gl.uniform4fv(program.u_shadow, layer.paint["terrain-shadow-color"]);
        gl.uniform4fv(program.u_highlight, layer.paint["terrain-highlight-color"]);
        gl.uniform4fv(program.u_accent, layer.paint["terrain-accent-color"]);

        const buffer = tile.boundsBuffer || this.painter.rasterBoundsBuffer;
        const vao = tile.boundsVAO || this.painter.rasterBoundsVAO;
        vao.bind(gl, program, buffer);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, buffer.length);
    }


    unbindFramebuffer() {
        const gl = this.painter.gl;
        this.painter.bindDefaultFramebuffer();
        gl.viewport(0, 0, this.painter.width, this.painter.height);
    }
}

function prepareTerrain(painter, tile, layer) {
    const gl = painter.gl;
    const terrainBucket = tile.getBucket(layer);
    // set up terrain prepare textures

    const levels = terrainBucket ? populateLevelPixels(terrainBucket.buffers.terrainArray, tile) : tile.dem.levels.map((l, i)=> {
        if (i > 7) return {width: l.width, height: l.height, data: new Uint8Array(l.data.buffer)};
        return {width: l.width * 2, height: l.height * 2, data: new Uint8Array(l.data.buffer)};
    });

    const dem = gl.createTexture();

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, dem);
    for (let i = 0; i < levels.length; i++) {
        gl.texImage2D(gl.TEXTURE_2D, i, gl.RGBA, levels[i].width, levels[i].height, 0, gl.RGBA, gl.UNSIGNED_BYTE, levels[i].data);
    }

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    tile.texture = new TerrainTexture(gl, painter, layer, tile);

    const matrix = mat4.create();
    // Flip rendering at y axis.
    mat4.ortho(matrix, 0, EXTENT, -EXTENT, 0, 0, 1);
    mat4.translate(matrix, matrix, [0, -EXTENT, 0]);

    gl.clearColor(1, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const program = painter.useProgram('terrainPrepare');

    gl.uniformMatrix4fv(program.u_matrix, false, matrix);

    gl.uniform1f(program.u_zoom, tile.coord.z);
    gl.uniform2fv(program.u_dimension, [512, 512]);
    gl.uniform1i(program.u_image, 1);

    const buffer = painter.rasterBoundsBuffer;
    const vao = painter.rasterBoundsVAO;

    vao.bind(gl, program, buffer);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, buffer.length);

    tile.texture.unbindFramebuffer();

    tile.prepared = true;
}

function populateLevelPixels(terrainArray) {
    const levels = [];
    let levelSize = TERRAIN_TILE_WIDTH;
    let prevIndex = 0;
    while (levelSize >= 2) {
        // levelSize * 2 = total width of texture with border
        // (levelSize *2)^2 = levelSize*levelSize*4 = total pixels in a tile
        // 4 = bytesPerElement for a Uint32Array
        const levelByteLength = levelSize * levelSize * 4 * 4;
        levels.push({height: levelSize * 2, width:levelSize * 2, data:new Uint8Array(terrainArray.arrayBuffer.slice(prevIndex, levelByteLength + prevIndex))});
        prevIndex += levelByteLength;
        levelSize /= 2;
    }
    levels.push({height: 2, width: 2, data:new Uint8Array(16)});
    levels.push({height: 1, width: 1, data:new Uint8Array(4)});
    return levels;
}
