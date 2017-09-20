// @flow

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type TileCoord from '../source/tile_coord';
import type StyleLayer from '../style/style_layer';


const EXTENT = require('../data/extent');
const mat4 = require('@mapbox/gl-matrix').mat4;


//size of raster terrain tile
const TERRAIN_TILE_WIDTH = 256;
const TERRAIN_TILE_HEIGHT = 256;

module.exports = drawHillshade;

function drawHillshade(painter: Painter, sourceCache: SourceCache, layer: StyleLayer, coords: Array<TileCoord>) {

    if (painter.renderPass === 'opaque' || painter.renderPass === '3d') return;

    painter.setDepthSublayer(0);
    const gl = painter.gl;
    gl.enable(gl.DEPTH_TEST);
    painter.depthMask(false);
    gl.disable(gl.STENCIL_TEST);


    const maxzoom = sourceCache.getSource().maxzoom;

    for (const coord of coords) {
        const tile = sourceCache.getTile(coord);
        if (!tile.texture) prepareHillshade(painter, tile);

        let bordersLoaded = true;
        if (painter.transform.tileZoom < maxzoom) {
            for (const key in tile.neighboringTiles) {
                if (!tile.neighboringTiles[key].backfilled && sourceCache._tiles[key]) {
                    bordersLoaded = false;
                    break;
                }
            }
        }

        renderHillshade(painter, tile, layer, bordersLoaded);
    }

}

class HillshadeTexture {

    gl: WebGLRenderingContext;
    fbo: WebGLFramebuffer;
    height: number;
    width: number;
    painter: Painter;

    constructor (gl: WebGLRenderingContext, painter: Painter, tile) {
        this.gl = gl;
        this.width = TERRAIN_TILE_WIDTH;
        this.height = TERRAIN_TILE_HEIGHT;
        this.painter = painter;

        gl.activeTexture(gl.TEXTURE0);
        tile.texture = gl.createTexture();

        // this is needed because SpriteAtlas sets this value to true, which causes the 0 alpha values that we pass to
        // the terrain_prepare shaders to 0 out all values and render the texture blank.
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, (false: any));

        gl.bindTexture(gl.TEXTURE_2D, tile.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        tile.texture.width = this.width;
        tile.texture.height = this.height;

        // reuse fbos?
        this.fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
        gl.viewport(0, 0, this.width, this.height);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tile.texture, 0);
    }

    unbindFramebuffer() {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.painter.width, this.painter.height);
    }
}

function setLight(program, painter) {
    const gl = painter.gl;
    const light = painter.style.light;
    const lightPositionRadians = (light.getLightProperty('position'): any).map((el, i)=>{ return i === 0 ? el : el * Math.PI / 180; });

    // modify azimuthal angle by map rotation if light is anchored at the viewport
    if (light.calculated.anchor === 'viewport')  lightPositionRadians[1] -= painter.transform.angle;

    gl.uniform3fv(program.uniforms.u_lightpos, lightPositionRadians);
    gl.uniform1f(program.uniforms.u_lightintensity, light.calculated.intensity);
}

function renderHillshade(painter, tile, layer, bordersLoaded) {
    const gl = painter.gl;
    const program = painter.useProgram('hillshade');
    const posMatrix = painter.transform.calculatePosMatrix(tile.coord);
    setLight(program, painter);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tile.texture);
    gl.uniformMatrix4fv(program.uniforms.u_matrix, false, posMatrix);
    gl.uniform1i(program.uniforms.u_image, 0);
    gl.uniform1i(program.uniforms.u_mode, 7);
    gl.uniform1f(program.uniforms.u_mipmap, 0);
    gl.uniform4fv(program.uniforms.u_shadow, layer.paint["hillshade-shadow-color"]);
    gl.uniform4fv(program.uniforms.u_highlight, layer.paint["hillshade-highlight-color"]);
    gl.uniform4fv(program.uniforms.u_accent, layer.paint["hillshade-accent-color"]);

    // this is to prevent purple/yellow seams from flashing when the dem tiles haven't been totally
    // backfilled from their neighboring tiles.
    if (tile.maskedBoundsBuffer && tile.maskedBoundsVAO) {
        const buffer = tile.maskedBoundsBuffer;
        const vao = tile.maskedBoundsVAO;
        vao.bind(gl, program, buffer);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, buffer.length);
    } else if (!bordersLoaded) {
        const buffer = painter.incompleteHillshadeBoundsBuffer;
        const vao = painter.incompleteHillshadeBoundsVAO;
        vao.bind(gl, program, buffer);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, buffer.length);
    } else {
        const buffer = painter.rasterBoundsBuffer;
        const vao = painter.incompleteHillshadeBoundsVAO;
        vao.bind(gl, program, buffer);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, buffer.length);
    }
}


function prepareHillshade(painter, tile) {
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
    if (tile.dem && tile.dem.data) {
        const pixelData = tile.dem.data.map((l)=> {
            return {width: l.width + 2 * l.border, height: l.height + 2 * l.border, data: new Uint8Array(l.data.buffer)};
        });

        const dem = gl.createTexture();

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, dem);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        for (let i = 0; i < pixelData.length; i++) {
            gl.texImage2D(gl.TEXTURE_2D, i, gl.RGBA, pixelData[i].width, pixelData[i].height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixelData[i].data);
        }

        const hillshadeTexture = new HillshadeTexture(gl, painter, tile);

        const matrix = mat4.create();
        // Flip rendering at y axis.
        mat4.ortho(matrix, 0, EXTENT, -EXTENT, 0, 0, 1);
        mat4.translate(matrix, matrix, [0, -EXTENT, 0]);

        const program = painter.useProgram('hillshadePrepare');

        gl.uniformMatrix4fv(program.uniforms.u_matrix, false, matrix);

        gl.uniform1f(program.uniforms.u_zoom, tile.coord.z);
        gl.uniform2fv(program.uniforms.u_dimension, [512, 512]);
        gl.uniform1i(program.uniforms.u_image, 1);

        const buffer = painter.rasterBoundsBuffer;
        const vao = painter.rasterBoundsVAO;

        vao.bind(gl, program, buffer);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, buffer.length);

        hillshadeTexture.unbindFramebuffer();
    }
}
