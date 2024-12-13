import Color from '../style-spec/util/color';
import ResolvedImage from '../style-spec/expression/types/resolved_image';
import DepthMode from '../gl/depth_mode';
import CullFaceMode from '../gl/cull_face_mode';
import {
    fillUniformValues,
    fillPatternUniformValues,
    fillOutlineUniformValues,
    fillOutlinePatternUniformValues
} from './program/fill_program';
import StencilMode from '../gl/stencil_mode';

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type FillStyleLayer from '../style/style_layer/fill_style_layer';
import type FillBucket from '../data/bucket/fill_bucket';
import type ColorMode from '../gl/color_mode';
import type {OverscaledTileID} from '../source/tile_id';

export default drawFill;

function drawFill(painter: Painter, sourceCache: SourceCache, layer: FillStyleLayer, coords: Array<OverscaledTileID>) {
    const color = layer.paint.get('fill-color');
    const opacity = layer.paint.get('fill-opacity');
    const is3D = layer.is3D();
    const depthModeFor3D = new DepthMode(painter.context.gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D);

    if (opacity.constantOr(1) === 0) {
        return;
    }

    const emissiveStrength = layer.paint.get('fill-emissive-strength');

    const colorMode = painter.colorModeForDrapableLayerRenderPass(emissiveStrength);

    const pattern = layer.paint.get('fill-pattern');
    const pass = painter.opaquePassEnabledForLayer() &&

        (!pattern.constantOr((1 as any)) &&

        color.constantOr(Color.transparent).a === 1 &&

        opacity.constantOr(0) === 1) ? 'opaque' : 'translucent';

    // Draw fill
    if (painter.renderPass === pass) {
        const depthMode = is3D ? depthModeFor3D : painter.depthModeForSublayer(
            1, painter.renderPass === 'opaque' ? DepthMode.ReadWrite : DepthMode.ReadOnly);
        drawFillTiles(painter, sourceCache, layer, coords, depthMode, colorMode, false);
    }

    // Draw stroke
    if (!is3D && painter.renderPass === 'translucent' && layer.paint.get('fill-antialias')) {

        // If we defined a different color for the fill outline, we are
        // going to ignore the bits in 0x07 and just care about the global
        // clipping mask.
        // Otherwise, we only want to drawFill the antialiased parts that are
        // *outside* the current shape. This is important in case the fill
        // or stroke color is translucent. If we wouldn't clip to outside
        // the current shape, some pixels from the outline stroke overlapped
        // the (non-antialiased) fill.
        const depthMode = is3D ? depthModeFor3D : painter.depthModeForSublayer(
            layer.getPaintProperty('fill-outline-color') ? 2 : 0, DepthMode.ReadOnly);
        drawFillTiles(painter, sourceCache, layer, coords, depthMode, colorMode, true);
    }
}

function drawFillTiles(painter: Painter, sourceCache: SourceCache, layer: FillStyleLayer, coords: Array<OverscaledTileID>, depthMode: DepthMode, colorMode: ColorMode, isOutline: boolean) {
    const gl = painter.context.gl;

    const patternProperty = layer.paint.get('fill-pattern');
    const is3D = layer.is3D();
    const stencilFor3D = is3D ? painter.stencilModeFor3D() : StencilMode.disabled;

    const image = patternProperty && patternProperty.constantOr((1 as any));
    let drawMode, programName, uniformValues, indexBuffer, segments;

    if (!isOutline) {
        programName = image ? 'fillPattern' : 'fill';
        drawMode = gl.TRIANGLES;
    } else {
        programName = image && !layer.getPaintProperty('fill-outline-color') ? 'fillOutlinePattern' : 'fillOutline';
        drawMode = gl.LINES;
    }

    for (const coord of coords) {
        const tile = sourceCache.getTile(coord);
        if (image && !tile.patternsLoaded()) continue;

        const bucket: FillBucket | null | undefined = (tile.getBucket(layer) as any);
        if (!bucket) continue;
        painter.prepareDrawTile();

        const programConfiguration = bucket.programConfigurations.get(layer.id);
        const affectedByFog = painter.isTileAffectedByFog(coord);
        const program = painter.getOrCreateProgram(programName, {config: programConfiguration, overrideFog: affectedByFog});

        if (image) {
            painter.context.activeTexture.set(gl.TEXTURE0);
            if (tile.imageAtlasTexture) {
                tile.imageAtlasTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
            }
            programConfiguration.updatePaintBuffers();
        }

        const constantPattern = patternProperty.constantOr(null);
        if (constantPattern && tile.imageAtlas) {
            const atlas = tile.imageAtlas;
            const patternImage = ResolvedImage.from(constantPattern);
            const posTo = atlas.patternPositions[patternImage.getSerializedPrimary()];
            if (posTo) programConfiguration.setConstantPatternPositions(posTo);
        }

        const tileMatrix = painter.translatePosMatrix(coord.projMatrix, tile,
            layer.paint.get('fill-translate'), layer.paint.get('fill-translate-anchor'));

        const emissiveStrength = layer.paint.get('fill-emissive-strength');

        if (!isOutline) {
            indexBuffer = bucket.indexBuffer;
            segments = bucket.segments;
            uniformValues = image ?
                fillPatternUniformValues(tileMatrix, emissiveStrength, painter, tile) :
                fillUniformValues(tileMatrix, emissiveStrength);
        } else {
            indexBuffer = bucket.indexBuffer2;
            segments = bucket.segments2;
            const drawingBufferSize: [number, number] = (painter.terrain && painter.terrain.renderingToTexture) ? painter.terrain.drapeBufferSize : [gl.drawingBufferWidth, gl.drawingBufferHeight];
            uniformValues = (programName === 'fillOutlinePattern' && image) ?
                fillOutlinePatternUniformValues(tileMatrix, emissiveStrength, painter, tile, drawingBufferSize) :
                fillOutlineUniformValues(tileMatrix, emissiveStrength, drawingBufferSize);
        }

        painter.uploadCommonUniforms(painter.context, program, coord.toUnwrapped());

        program.draw(painter, drawMode, depthMode,
            is3D ? stencilFor3D : painter.stencilModeForClipping(coord), colorMode, CullFaceMode.disabled, uniformValues,
            layer.id, bucket.layoutVertexBuffer, indexBuffer, segments,
            layer.paint, painter.transform.zoom, programConfiguration, undefined);
    }
}
