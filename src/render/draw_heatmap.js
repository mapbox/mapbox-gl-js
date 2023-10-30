// @flow

import Texture from './texture.js';
import Color from '../style-spec/util/color.js';
import DepthMode from '../gl/depth_mode.js';
import StencilMode from '../gl/stencil_mode.js';
import ColorMode from '../gl/color_mode.js';
import CullFaceMode from '../gl/cull_face_mode.js';
import {
    heatmapUniformValues,
    heatmapTextureUniformValues
} from './program/heatmap_program.js';
import {mercatorXfromLng, mercatorYfromLat} from '../geo/mercator_coordinate.js';

import type Painter from './painter.js';
import type Context from '../gl/context.js';
import type Framebuffer from '../gl/framebuffer.js';
import type SourceCache from '../source/source_cache.js';
import type HeatmapStyleLayer from '../style/style_layer/heatmap_style_layer.js';
import type HeatmapBucket from '../data/bucket/heatmap_bucket.js';
import type {OverscaledTileID} from '../source/tile_id.js';

export default drawHeatmap;

function drawHeatmap(painter: Painter, sourceCache: SourceCache, layer: HeatmapStyleLayer, coords: Array<OverscaledTileID>) {
    if (layer.paint.get('heatmap-opacity') === 0) {
        return;
    }

    if (painter.renderPass === 'offscreen') {
        const context = painter.context;
        const gl = context.gl;

        // Allow kernels to be drawn across boundaries, so that
        // large kernels are not clipped to tiles
        const stencilMode = StencilMode.disabled;
        // Turn on additive blending for kernels, which is a key aspect of kernel density estimation formula
        const colorMode = new ColorMode([gl.ONE, gl.ONE, gl.ONE, gl.ONE], Color.transparent, [true, true, true, true]);
        const resolutionScaling = painter.transform.projection.name === 'globe' ? 0.5 : 0.25;

        bindFramebuffer(context, painter, layer, resolutionScaling);

        context.clear({color: Color.transparent});

        const tr = painter.transform;

        const isGlobeProjection = tr.projection.name === 'globe';

        const definesValues = isGlobeProjection ? ['PROJECTION_GLOBE_VIEW'] : [];
        const cullMode = isGlobeProjection ? CullFaceMode.frontCCW : CullFaceMode.disabled;

        const mercatorCenter = [mercatorXfromLng(tr.center.lng), mercatorYfromLat(tr.center.lat)];

        for (let i = 0; i < coords.length; i++) {
            const coord = coords[i];

            // Skip tiles that have uncovered parents to avoid flickering; we don't need
            // to use complex tile masking here because the change between zoom levels is subtle,
            // so it's fine to simply render the parent until all its 4 children are loaded
            if (sourceCache.hasRenderableParent(coord)) continue;

            const tile = sourceCache.getTile(coord);
            const bucket: ?HeatmapBucket = (tile.getBucket(layer): any);
            if (!bucket || bucket.projection.name !== tr.projection.name) continue;

            const affectedByFog = painter.isTileAffectedByFog(coord);
            const programConfiguration = bucket.programConfigurations.get(layer.id);
            const program = painter.getOrCreateProgram('heatmap', {config: programConfiguration, defines: definesValues, overrideFog: affectedByFog});
            const {zoom} = painter.transform;
            if (painter.terrain) painter.terrain.setupElevationDraw(tile, program);

            painter.uploadCommonUniforms(context, program, coord.toUnwrapped());

            const invMatrix = tr.projection.createInversionMatrix(tr, coord.canonical);

            program.draw(painter, gl.TRIANGLES, DepthMode.disabled, stencilMode, colorMode, cullMode,
                heatmapUniformValues(painter, coord,
                    tile, invMatrix, mercatorCenter, zoom, layer.paint.get('heatmap-intensity')),
                layer.id, bucket.layoutVertexBuffer, bucket.indexBuffer,
                bucket.segments, layer.paint, painter.transform.zoom,
                programConfiguration, isGlobeProjection ? [bucket.globeExtVertexBuffer] : null);
        }

        context.viewport.set([0, 0, painter.width, painter.height]);

    } else if (painter.renderPass === 'translucent') {
        painter.context.setColorMode(painter.colorModeForRenderPass());
        renderTextureToMap(painter, layer);
    }
}

function bindFramebuffer(context: Context, painter: Painter, layer: HeatmapStyleLayer, scaling: number) {
    const gl = context.gl;
    const width = painter.width * scaling;
    const height = painter.height * scaling;

    context.activeTexture.set(gl.TEXTURE1);
    context.viewport.set([0, 0, width, height]);

    let fbo = layer.heatmapFbo;

    if (!fbo || (fbo && (fbo.width !== width || fbo.height !== height))) {
        if (fbo) { fbo.destroy(); }

        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        fbo = layer.heatmapFbo = context.createFramebuffer(width, height, true, null);

        bindTextureToFramebuffer(context, painter, texture, fbo, width, height);

    } else {
        gl.bindTexture(gl.TEXTURE_2D, fbo.colorAttachment.get());
        context.bindFramebuffer.set(fbo.framebuffer);
    }
}

function bindTextureToFramebuffer(context: Context, painter: Painter, texture: ?WebGLTexture, fbo: Framebuffer, width: number, height: number) {
    const gl = context.gl;
    // Use the higher precision half-float texture where available (producing much smoother looking heatmaps);
    // Otherwise, fall back to a low precision texture
    const type = context.extRenderToTextureHalfFloat ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
    gl.texImage2D(gl.TEXTURE_2D, 0, context.extRenderToTextureHalfFloat ? gl.RGBA16F : gl.RGBA, width, height, 0, gl.RGBA, type, null);
    fbo.colorAttachment.set(texture);
}

function renderTextureToMap(painter: Painter, layer: HeatmapStyleLayer) {
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

    painter.getOrCreateProgram('heatmapTexture').draw(painter, gl.TRIANGLES,
        DepthMode.disabled, StencilMode.disabled, painter.colorModeForRenderPass(), CullFaceMode.disabled,
        heatmapTextureUniformValues(painter, layer, 0, 1),
        layer.id, painter.viewportBuffer, painter.quadTriangleIndexBuffer,
        painter.viewportSegments, layer.paint, painter.transform.zoom);
}
