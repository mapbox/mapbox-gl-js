// @flow
const TileCoord = require('../source/tile_coord');
const Texture = require('./texture');
const RenderTexture = require('./render_texture');

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type StyleLayer from '../style/style_layer';


const EXTENT = require('../data/extent');
const mat4 = require('@mapbox/gl-matrix').mat4;


//size of raster terrain tile
const TERRAIN_TILE_WIDTH = 256;
const TERRAIN_TILE_HEIGHT = 256;

module.exports = drawHillshade;

function drawHillshade(painter: Painter, sourceCache: SourceCache, layer: StyleLayer, coords: Array<TileCoord>) {
    if (painter.renderPass !== 'hillshadeprepare' && painter.renderPass !== 'translucent') return;

    const gl = painter.gl;

    painter.setDepthSublayer(0);
    gl.disable(gl.STENCIL_TEST);

    for (const coord of coords) {
        const tile = sourceCache.getTile(coord);
        if (tile.needsHillshadePrepare && painter.renderPass === 'hillshadeprepare') {
            prepareHillshade(painter, tile);
            continue;
        } else if (painter.renderPass === 'translucent') {
            renderHillshade(painter, tile, layer);
        }
    }

}

function setLight(program, painter) {
    const gl = painter.gl;
    const light = painter.style.light;

    const lightPositionRadians = (light.getLightProperty('position'): any).map(el => el * Math.PI / 180);

    // modify azimuthal angle by map rotation if light is anchored at the viewport
    if (light.calculated.anchor === 'viewport')  lightPositionRadians[1] -= painter.transform.angle;

    // we don't use the radial coordinate when rendering hillshade, so we replace that value with the intensity variable
    lightPositionRadians[0] = light.calculated.intensity;
    gl.uniform3fv(program.uniforms.u_light, lightPositionRadians);

}

function getTileLatRange(painter, coord) {
    const coordinate0 = coord.toCoordinate();
    const coordinate1 = new TileCoord(coord.z, coord.x, coord.y + 1, coord.w).toCoordinate();
    return [painter.transform.coordinateLocation(coordinate0).lat, painter.transform.coordinateLocation(coordinate1).lat];
}

function renderHillshade(painter, tile, layer) {
    const gl = painter.gl;
    const program = painter.useProgram('hillshade');
    const posMatrix = painter.transform.calculatePosMatrix(tile.coord);
    const zoom = painter.transform.zoom;
    setLight(program, painter);
    // for scaling the magnitude of a points slope by its latitude
    const latRange = getTileLatRange(painter, tile.coord);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tile.texture.texture);
    gl.uniformMatrix4fv(program.uniforms.u_matrix, false, posMatrix);
    gl.uniform2fv(program.uniforms.u_latrange, latRange);
    gl.uniform1i(program.uniforms.u_image, 0);
    gl.uniform1i(program.uniforms.u_mode, 1);
    gl.uniform4fv(program.uniforms.u_shadow, layer.getPaintValue("hillshade-shadow-color", {zoom: zoom}));
    gl.uniform4fv(program.uniforms.u_highlight, layer.getPaintValue("hillshade-highlight-color", {zoom: zoom}));
    gl.uniform4fv(program.uniforms.u_accent, layer.getPaintValue("hillshade-accent-color", {zoom: zoom}));

    // this is to prevent purple/yellow seams from flashing when the dem tiles haven't been totally
    // backfilled from their neighboring tiles.
    if (tile.maskedBoundsBuffer && tile.maskedIndexBuffer && tile.segments) {
        program.draw(
            gl,
            gl.TRIANGLES,
            layer.id,
            tile.maskedBoundsBuffer,
            tile.maskedIndexBuffer,
            tile.segments
        );
    } else {
        const buffer = painter.rasterBoundsBuffer;
        const vao = painter.rasterBoundsVAO;
        vao.bind(gl, program, buffer);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, buffer.length);
    }
}


// hillshade rendering is done in two steps. the prepare step first calculates the slope of the terrain in the x and y
// directions for each pixel, and saves those values to a framebuffer texture in the r and g channels.

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
    if (tile.dem && tile.dem.level) {
        const pixelData = tile.dem.getPixels();
        gl.activeTexture(gl.TEXTURE1);

        // if UNPACK_PREMULTIPLY_ALPHA_WEBGL is set to true prior to drawHillshade being called
        // tiles will appear blank, because as you can see above the alpha value for these textures
        // is always 0
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, (false: any));


        tile.demTexture = tile.demTexture || painter.getTileTexture(tile.tileSize);
        if (tile.demTexture) {
            const demTexture = tile.demTexture;
            demTexture.update(pixelData, false);
            demTexture.bind(gl.NEAREST, gl.CLAMP_TO_EDGE);
        } else {
            tile.demTexture = new Texture(gl, pixelData, gl.RGBA, false);
            tile.demTexture.bind(gl.NEAREST, gl.CLAMP_TO_EDGE);
        }


        gl.activeTexture(gl.TEXTURE0);

        if (!tile.texture) {
            tile.texture = new RenderTexture(painter, TERRAIN_TILE_HEIGHT, TERRAIN_TILE_WIDTH);
        } else {
            tile.texture.clear(TERRAIN_TILE_HEIGHT, TERRAIN_TILE_WIDTH);
        }

        gl.viewport(0, 0, TERRAIN_TILE_HEIGHT, TERRAIN_TILE_WIDTH);



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

        tile.texture.unbind();
        gl.viewport(0, 0, painter.width, painter.height);
        tile.needsHillshadePrepare = false;
    }
}
