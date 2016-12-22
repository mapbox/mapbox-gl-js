'use strict';
const mat4 = require('gl-matrix').mat4;
const EXTENT = require('../data/extent');

module.exports = drawTerrain;

//size of raster terrain tile
const TERRAIN_TILE_WIDTH = 256;

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
    let tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, TERRAIN_TILE_WIDTH, TERRAIN_TILE_WIDTH, 0, gl.RGBA, gl.UNSIGNED_BYTE,new Uint8Array(TERRAIN_TILE_WIDTH*TERRAIN_TILE_WIDTH*4));
    // We are using clamp to edge here since OpenGL ES doesn't allow GL_REPEAT on NPOT textures.
    // We use those when the pixelRatio isn't a power of two, e.g. on iPhone 6 Plus.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    let framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0,0,TERRAIN_TILE_WIDTH,TERRAIN_TILE_WIDTH);

    gl.bindTexture(gl.TEXTURE_2D, tile.dem);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.activeTexture(gl.TEXTURE0);

    const mat = mat4.create();
    mat.ortho(mat, 0, EXTENT, -EXTENT, 0, 0, 1);
    mat.translate(mat, mat, 0, -EXTENT, 0);


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
