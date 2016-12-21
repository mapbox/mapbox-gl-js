'use strict';

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
        if (!tile.levels) {
            // set up terrain prepare textures
            tile.levels = populateLevelPixels(terrainBucket.buffers.terrainArray);
            tile.texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tile.texture);
            for (var i=0; i<tile.levels.length; i++){
                gl.texImage2D(gl.TEXTURE_2D, i, gl.RGBA, tile.levels[0].width, tile.levels[0].height, 0, gl.RGBA, gl.UNSIGNED_BYTE, tile.levels[0].data);
            }


        }
    }
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
