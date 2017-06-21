'use strict';

const EXTENT = require('../data/extent');
const parseColor = require('./../style-spec/util/parse_color');
const glMatrix = require('@mapbox/gl-matrix');
const mat3 = glMatrix.mat3;
const mat4 = glMatrix.mat4;
const vec3 = glMatrix.vec3;

module.exports = drawTerrain;

//size of raster terrain tile
const TERRAIN_TILE_WIDTH = 256;
const TERRAIN_TILE_HEIGHT = 256;


function drawTerrain(painter, sourceCache, layer, coords) {
    if (painter.isOpaquePass) return;

    painter.setDepthSublayer(0);
    const gl = painter.gl;
    gl.enable(gl.DEPTH_TEST);
    painter.depthMask(false);
    gl.disable(gl.STENCIL_TEST);


    for (const coord of coords) {
        const tile = sourceCache.getTile(coord);
        if (painter.isPrepareFbosPass) {
            if (!tile.terrainTexture) prepareTerrain(painter, tile, layer);
        } else {
            tile.bordersLoaded = true;
            for (const key in tile.neighboringTiles) {
                if (!tile.neighboringTiles[key].backfilled && sourceCache._tiles[key]) {
                    tile.bordersLoaded = false;
                    break;
                }
            }

            tile.terrainTexture.render(tile, layer);
        }
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

        // needed because SpriteAtlas sets this value to true, which causes the 0 alpha values that we pass to
        // the terrain_prepare shaders to 0 out all values and render the texture blank.
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

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
        setLight(program, this.painter);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);

        gl.uniformMatrix4fv(program.u_matrix, false, posMatrix);
        gl.uniform1i(program.u_image, 0);
        gl.uniform1i(program.u_mode, 7);
        gl.uniform2fv(program.u_dimension, [256, 256]);
        gl.uniform1f(program.u_zoom, tile.coord.z);
        gl.uniform1f(program.u_mipmap, 0);
        gl.uniform4fv(program.u_shadow, parseColor(layer.paint["terrain-shadow-color"]));
        gl.uniform4fv(program.u_highlight, parseColor(layer.paint["terrain-highlight-color"]));
        gl.uniform4fv(program.u_accent, parseColor(layer.paint["terrain-accent-color"]));

        // this is to prevent purple/yellow seams from flashing when the dem tiles haven't been totally
        // backfilled from their neighboring tiles.
        const buffer = tile.bordersLoaded ? this.painter.rasterBoundsBuffer : this.painter.incompleteTerrainBoundsBuffer;
        const vao = tile.bordersLoaded ? this.painter.rasterBoundsVAO : this.painter.incompleteTerrainBoundsVAO;
        vao.bind(gl, program, buffer);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, buffer.length);
    }


    unbindFramebuffer() {
        const gl = this.painter.gl;
        this.painter.bindDefaultFramebuffer();
        gl.viewport(0, 0, this.painter.width, this.painter.height);
    }
}

function setLight(program, painter) {
    const gl = painter.gl;
    const light = painter.style.light;

    const _lp = light.calculated.position,
        lightPos = [_lp.x, _lp.y, _lp.z];
    // console.log(toSpherical(lightPos));
    const lightMat = mat3.create();
    if (light.calculated.anchor === 'viewport') mat3.fromRotation(lightMat, -painter.transform.angle);
    vec3.transformMat3(lightPos, lightPos, lightMat);
    // console.log(toSpherical(lightPos));
    // TODO figure out why after > 140 degrees of rotation of the map, the light gets flipped.

    gl.uniform3fv(program.u_lightpos, lightPos);
    gl.uniform1f(program.u_lightintensity, light.calculated.intensity);
}

// TODO delete
// function toSpherical(lightpos) {
//     const r = Math.sqrt(Math.pow(lightpos[0], 2.0) + Math.pow(lightpos[1], 2.0) + Math.pow(lightpos[2], 2.0));
//     const polar = Math.acos(lightpos[2] / r);
//     const azimuth =  Math.atan(lightpos[1] / lightpos[0]);

//     return [azimuth * 180 / Math.PI, polar * 180 / Math.PI, r];
// }

function prepareTerrain(painter, tile, layer) {
    const gl = painter.gl;
    // decode rgba levels by using integer overflow to convert each Uint32Array element -> 4 Uint8Array elements.
    // ex.
    // Uint32:
    // base 10 - 67308
    // base 2 - 0000 0000 0000 0001 0000 0110 1110 1100
    //
    // Uint8:
    // base 10 - 0, 1, 6, 236 (this order is reversed in the resulting array via the overflow.
    // first 8 bits represent 236, so the r component of the texture pixel will be 236 etc.)
    // base 2 - 0000 0000, 0000 0001, 0000 0110, 1110 1100

    const levels = tile.dem.levels.map((l)=> {
        return {width: l.width + 2 * l.border, height: l.height + 2 * l.border, data: new Uint8Array(l.data.buffer)};
    });

    const dem = gl.createTexture();

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, dem);

    for (let i = 0; i < levels.length; i++) {
        gl.texImage2D(gl.TEXTURE_2D, i, gl.RGBA, levels[i].width, levels[i].height, 0, gl.RGBA, gl.UNSIGNED_BYTE, levels[i].data);
    }

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    tile.terrainTexture = new TerrainTexture(gl, painter, layer, tile);

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

    tile.terrainTexture.unbindFramebuffer();
    tile.prepared = true;
}
