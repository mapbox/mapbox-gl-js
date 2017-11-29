// @flow

const mat4 = require('@mapbox/gl-matrix').mat4;
const Texture = require('./texture');
const pixelsToTileUnits = require('../source/pixels_to_tile_units');
const Color = require('../style-spec/util/color');
const DepthMode = require('../gl/depth_mode');
const StencilMode = require('../gl/stencil_mode');
const util = require('../util/util');

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type HeatmapStyleLayer from '../style/style_layer/heatmap_style_layer';
import type HeatmapBucket from '../data/bucket/heatmap_bucket';
import type {OverscaledTileID} from '../source/tile_id';

module.exports = drawHeatmap;

function drawHeatmap(painter: Painter, sourceCache: SourceCache, layer: HeatmapStyleLayer, coords: Array<OverscaledTileID>) {
    if (layer.paint.get('heatmap-opacity') === 0) {
        return;
    }

    if (painter.renderPass === 'offscreen') {
        const context = painter.context;
        const gl = context.gl;

        context.setDepthMode(painter.depthModeForSublayer(0, DepthMode.ReadOnly));

        // Allow kernels to be drawn across boundaries, so that
        // large kernels are not clipped to tiles
        context.setStencilMode(StencilMode.disabled());

        bindFramebuffer(context, painter, layer);

        context.clear({ color: Color.transparent });

        // Turn on additive blending for kernels, which is a key aspect of kernel density estimation formula
        context.setColorMode(util.extend(painter.colorModeForRenderPass(), {
            blendFunction: [gl.ONE, gl.ONE]
        }));

        for (let i = 0; i < coords.length; i++) {
            const coord = coords[i];

            // Skip tiles that have uncovered parents to avoid flickering; we don't need
            // to use complex tile masking here because the change between zoom levels is subtle,
            // so it's fine to simply render the parent until all its 4 children are loaded
            if (sourceCache.hasRenderableParent(coord)) continue;

            const tile = sourceCache.getTile(coord);
            const bucket: ?HeatmapBucket = (tile.getBucket(layer): any);
            if (!bucket) continue;

            const programConfiguration = bucket.programConfigurations.get(layer.id);
            const program = painter.useProgram('heatmap', programConfiguration);
            const {zoom} = painter.transform;
            programConfiguration.setUniforms(painter.context, program, layer.paint, {zoom});
            gl.uniform1f(program.uniforms.u_radius, layer.paint.get('heatmap-radius'));

            gl.uniform1f(program.uniforms.u_extrude_scale, pixelsToTileUnits(tile, 1, zoom));

            gl.uniform1f(program.uniforms.u_intensity, layer.paint.get('heatmap-intensity'));
            gl.uniformMatrix4fv(program.uniforms.u_matrix, false, coord.posMatrix);

            program.draw(
                context,
                gl.TRIANGLES,
                layer.id,
                bucket.layoutVertexBuffer,
                bucket.indexBuffer,
                bucket.segments,
                programConfiguration);
        }

        context.viewport.set([0, 0, painter.width, painter.height]);

    } else if (painter.renderPass === 'translucent') {
        painter.context.setColorMode(painter.colorModeForRenderPass());
        renderTextureToMap(painter, layer);
    }
}

function bindFramebuffer(context, painter, layer) {
    const gl = context.gl;
    context.activeTexture.set(gl.TEXTURE1);

    // Use a 4x downscaled screen texture for better performance
    context.viewport.set([0, 0, painter.width / 4, painter.height / 4]);

    let fbo = layer.heatmapFbo;

    if (!fbo) {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        fbo = layer.heatmapFbo = context.createFramebuffer(painter.width / 4, painter.height / 4);

        bindTextureToFramebuffer(context, painter, texture, fbo);

    } else {
        gl.bindTexture(gl.TEXTURE_2D, fbo.colorAttachment.get());
        context.bindFramebuffer.set(fbo.framebuffer);
    }
}

function bindTextureToFramebuffer(context, painter, texture, fbo) {
    const gl = context.gl;
    // Use the higher precision half-float texture where available (producing much smoother looking heatmaps);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, painter.width / 4, painter.height / 4, 0, gl.RGBA,
        context.extTextureHalfFloat ? context.extTextureHalfFloat.HALF_FLOAT_OES : gl.UNSIGNED_BYTE, null);

    fbo.colorAttachment.set(texture);

    // If using half-float texture as a render target is not supported, fall back to a low precision texture
    if (context.extTextureHalfFloat && gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        context.extTextureHalfFloat = null;
        fbo.colorAttachment.setDirty();
        bindTextureToFramebuffer(context, painter, texture, fbo);
    }
}

function renderTextureToMap(painter, layer) {
    const context = painter.context;
    const gl = context.gl;


    // Here we bind two different textures from which we'll sample in drawing
    // heatmaps: the kernel texture, prepared in the offscreen pass, and a
    // color ramp texture.
    const fbo = layer.heatmapFbo;
    if (!fbo) return;
    context.activeTexture.set(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fbo.colorAttachment.get());

    context.activeTexture.set(gl.TEXTURE1);
    let colorRampTexture = layer.colorRampTexture;
    if (!colorRampTexture) {
        colorRampTexture = layer.colorRampTexture = new Texture(context, layer.colorRamp, gl.RGBA);
    }
    colorRampTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);

    context.setDepthMode(DepthMode.disabled());

    const program = painter.useProgram('heatmapTexture');

    const opacity = layer.paint.get('heatmap-opacity');
    gl.uniform1f(program.uniforms.u_opacity, opacity);
    gl.uniform1i(program.uniforms.u_image, 0);
    gl.uniform1i(program.uniforms.u_color_ramp, 1);

    const matrix = mat4.create();
    mat4.ortho(matrix, 0, painter.width, painter.height, 0, 0, 1);
    gl.uniformMatrix4fv(program.uniforms.u_matrix, false, matrix);

    gl.uniform2f(program.uniforms.u_world, gl.drawingBufferWidth, gl.drawingBufferHeight);

    painter.viewportVAO.bind(painter.context, program, painter.viewportBuffer, []);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
