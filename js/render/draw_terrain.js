'use strict';
const mat4 = require('gl-matrix').mat4;
const EXTENT = require('../data/extent');

module.exports = drawTerrain;

//size of raster terrain tile
const TERRAIN_TILE_WIDTH = 256;
const TERRAIN_TILE_HEIGHT = 256;

function drawTerrain(painter, sourceCache, layer, coords){
    if (painter.isOpaquePass) return;

    const gl = painter.gl;

    gl.enable(gl.DEPTH_TEST);
    painter.depthMask(true);

    // Change depth function to prevent double drawing in areas where tiles overlap.
    gl.depthFunc(gl.LESS);

    for (const coord of coords) {
        const tile = sourceCache.getTile(coord);
        const terrainBucket = tile.getBucket(layer);
        if (!terrainBucket) continue;
        if (!tile.dem) {
            // set up terrain prepare textures
            tile.levels = populateLevelPixels(terrainBucket.buffers.terrainArray);
            tile.dem = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tile.dem);
            for (var i=0; i<tile.levels.length; i++){
                gl.texImage2D(gl.TEXTURE_2D, i, gl.RGBA, tile.levels[i].width, tile.levels[i].height, 0, gl.RGBA, gl.UNSIGNED_BYTE, tile.levels[i].data);
            }
        }
        tile.uploaded=true;
        if (!tile.prepared) prepareTerrain(painter, tile);
    }
}

function prepareTerrain(painter, tile) {
    const gl = painter.gl;
    // create empty texture
    let tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // We are using clamp to edge here since OpenGL ES doesn't allow GL_REPEAT on NPOT textures.
    // We use those when the pixelRatio isn't a power of two, e.g. on iPhone 6 Plus.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, TERRAIN_TILE_WIDTH, TERRAIN_TILE_HEIGHT, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    let fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

    gl.viewport(0,0,TERRAIN_TILE_WIDTH,TERRAIN_TILE_HEIGHT);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const matrix = mat4.create();
    // Flip rendering at y axis.
    mat4.ortho(0, TERRAIN_TILE_WIDTH, -TERRAIN_TILE_HEIGHT, 0, 0, 1, matrix);
    mat4.translate(matrix, matrix, [0, -TERRAIN_TILE_HEIGHT, 0]);

    const program = painter.useProgram('terrainPrepare');

    gl.uniformMatrix4fv(program.u_matrix, false, matrix);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tile.dem);

    gl.uniform1f(program.u_zoom, tile.coord.z);
    gl.uniform2fv(program.u_dimension, [512,512]);
    gl.uniform1i(program.u_image, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, painter.rasterBoundsBuffer);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);

    tile.texture = tex;
    tile.prepared = true;
}

function populateLevelPixels(terrainArray) {
    let levels = [];
    let levelSize = TERRAIN_TILE_WIDTH;
    let prevIndex = 0;
    while (levelSize >= 2) {
        // levelSize * 2 = total width of texture with border
        // (levelSize *2)^2 = levelSize*levelSize*4
        // 4 = bitesPerElement for a Uint32Array
        const levelByteLength = levelSize * levelSize * 4 * 4;
        levels.push({height: levelSize*2, width:levelSize*2, data:new Uint8Array(terrainArray.arrayBuffer.slice(prevIndex,levelByteLength+prevIndex))});
        prevIndex += levelByteLength;
        levelSize /= 2;
    }
    levels.push({height: 2, width: 2, data:new Uint8Array(16)});
    levels.push({height: 1, width: 1, data:new Uint8Array(4)});
    return levels;
}
