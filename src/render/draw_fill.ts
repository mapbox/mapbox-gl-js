import Color from '../style-spec/util/color';
import ResolvedImage from '../style-spec/expression/types/resolved_image';
import DepthMode from '../gl/depth_mode';
import CullFaceMode from '../gl/cull_face_mode';
import {
    fillUniformValues,
    fillPatternUniformValues,
    fillOutlineUniformValues,
    fillOutlinePatternUniformValues,
    elevatedStructuresUniformValues
} from './program/fill_program';
import StencilMode from '../gl/stencil_mode';
import browser from '../util/browser';
import assert from 'assert';

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type FillStyleLayer from '../style/style_layer/fill_style_layer';
import type FillBucket from '../data/bucket/fill_bucket';
import type ColorMode from '../gl/color_mode';
import type {OverscaledTileID} from '../source/tile_id';
import type {DynamicDefinesType} from './program/program_uniforms';
import type VertexBuffer from '../gl/vertex_buffer';
import type {ElevationType} from '../../3d-style/elevation/elevation_constants';

export default drawFill;

interface DrawFillParams {
    painter: Painter;
    sourceCache: SourceCache;
    layer: FillStyleLayer;
    coords: Array<OverscaledTileID>;
    colorMode: ColorMode;
    elevationType: ElevationType;
    terrainEnabled: boolean;
    pass: 'opaque' | 'translucent';
}

function drawFill(painter: Painter, sourceCache: SourceCache, layer: FillStyleLayer, coords: Array<OverscaledTileID>) {
    const color = layer.paint.get('fill-color');
    const opacity = layer.paint.get('fill-opacity');

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

    let elevationType: ElevationType = 'none';

    if (layer.layout.get('fill-elevation-reference') !== 'none') {
        elevationType = 'road';
    } else if (layer.paint.get('fill-z-offset').constantOr(1.0) !== 0.0) {
        elevationType = 'offset';
    }

    const terrainEnabled = !!(painter.terrain && painter.terrain.enabled);

    const drawFillParams = <DrawFillParams>{
        painter, sourceCache, layer, coords, colorMode, elevationType, terrainEnabled, pass
    };

    // Draw offset elevation
    if (elevationType === 'offset') {
        drawFillTiles(drawFillParams, false, painter.stencilModeFor3D());
        return;
    }

    // Draw non-elevated polygons
    drawFillTiles(drawFillParams, false);

    if (elevationType === 'road') {
        const roadElevationActive = !terrainEnabled && painter.renderPass === 'translucent';

        // Draw elevated polygons
        drawFillTiles(drawFillParams, true, StencilMode.disabled);

        if (roadElevationActive) {
            drawElevatedStructures(drawFillParams);
        }
    }
}

function drawElevatedStructures(params: DrawFillParams) {
    const {painter, sourceCache, layer, coords, colorMode} = params;
    const gl = painter.context.gl;

    const programName = 'elevatedStructures';
    const depthMode = new DepthMode(painter.context.gl.LEQUAL, DepthMode.ReadOnly, painter.depthRangeFor3D);

    for (const coord of coords) {
        const tile = sourceCache.getTile(coord);
        const bucket = tile.getBucket(layer) as FillBucket;
        if (!bucket) continue;

        const elevatedStructures = bucket.elevatedStructures;
        if (!elevatedStructures || !elevatedStructures.renderableSegments ||
            elevatedStructures.renderableSegments.segments[0].primitiveLength === 0) {
            continue;
        }

        assert(elevatedStructures.vertexBuffer && elevatedStructures.vertexBufferNormal && elevatedStructures.indexBuffer);

        painter.prepareDrawTile();

        const programConfiguration = bucket.bufferData.programConfigurations.get(layer.id);
        const affectedByFog = painter.isTileAffectedByFog(coord);

        const dynamicDefines: DynamicDefinesType[] = ['NORMAL_OFFSET'];
        const program = painter.getOrCreateProgram(programName, {config: programConfiguration, overrideFog: affectedByFog, defines: dynamicDefines});

        const tileMatrix = painter.translatePosMatrix(coord.projMatrix, tile,
            layer.paint.get('fill-translate'), layer.paint.get('fill-translate-anchor'));

        const uniformValues = elevatedStructuresUniformValues(tileMatrix);

        painter.uploadCommonUniforms(painter.context, program, coord.toUnwrapped());

        program.draw(painter, gl.TRIANGLES, depthMode,
            StencilMode.disabled, colorMode, CullFaceMode.backCCW, uniformValues,
            layer.id, elevatedStructures.vertexBuffer, elevatedStructures.indexBuffer, elevatedStructures.renderableSegments,
            layer.paint, painter.transform.zoom, programConfiguration, [elevatedStructures.vertexBufferNormal]);
    }

}

function drawFillTiles(params: DrawFillParams, elevatedGeometry: boolean, stencilModeOverride?: StencilMode) {
    const {painter, sourceCache, layer, coords, colorMode, elevationType, terrainEnabled, pass} = params;
    const gl = painter.context.gl;

    const patternProperty = layer.paint.get('fill-pattern');

    let activeElevationType = elevationType;
    if (elevationType === 'road' && (!elevatedGeometry || terrainEnabled)) {
        activeElevationType = 'none';
    }

    const renderElevatedRoads = activeElevationType === 'road';
    const depthModeFor3D = new DepthMode(painter.context.gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D);

    const image = patternProperty && patternProperty.constantOr((1 as any));

    const draw = (depthMode: DepthMode, isOutline: boolean) => {
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

            const bufferData = elevatedGeometry ? bucket.elevationBufferData : bucket.bufferData;
            if (bufferData.isEmpty()) continue;

            painter.prepareDrawTile();

            const programConfiguration = bufferData.programConfigurations.get(layer.id);
            const affectedByFog = painter.isTileAffectedByFog(coord);

            const dynamicDefines: DynamicDefinesType[] = [];
            const dynamicBuffers: VertexBuffer[] = [];
            if (renderElevatedRoads) {
                dynamicDefines.push('ELEVATED_ROADS');
                dynamicBuffers.push(bufferData.elevatedLayoutVertexBuffer);
            }

            const program = painter.getOrCreateProgram(programName, {config: programConfiguration, overrideFog: affectedByFog, defines: dynamicDefines});

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
                const patternImage = ResolvedImage.from(constantPattern).getPrimary().scaleSelf(browser.devicePixelRatio).toString();
                const posTo = atlas.patternPositions.get(patternImage);
                if (posTo) programConfiguration.setConstantPatternPositions(posTo);
            }

            const tileMatrix = painter.translatePosMatrix(coord.projMatrix, tile,
                layer.paint.get('fill-translate'), layer.paint.get('fill-translate-anchor'));

            const emissiveStrength = layer.paint.get('fill-emissive-strength');

            if (!isOutline) {
                indexBuffer = bufferData.indexBuffer;
                segments = bufferData.triangleSegments;
                uniformValues = image ?
                    fillPatternUniformValues(tileMatrix, emissiveStrength, painter, tile) :
                    fillUniformValues(tileMatrix, emissiveStrength);
            } else {
                indexBuffer = bufferData.lineIndexBuffer;
                segments = bufferData.lineSegments;
                const drawingBufferSize: [number, number] =
                    (painter.terrain && painter.terrain.renderingToTexture) ? painter.terrain.drapeBufferSize : [gl.drawingBufferWidth, gl.drawingBufferHeight];
                uniformValues = (programName === 'fillOutlinePattern' && image) ?
                    fillOutlinePatternUniformValues(tileMatrix, emissiveStrength, painter, tile, drawingBufferSize) :
                    fillOutlineUniformValues(tileMatrix, emissiveStrength, drawingBufferSize);
            }

            painter.uploadCommonUniforms(painter.context, program, coord.toUnwrapped());

            program.draw(painter, drawMode, activeElevationType !== 'none' ? depthModeFor3D : depthMode,
                stencilModeOverride ? stencilModeOverride : painter.stencilModeForClipping(coord), colorMode, CullFaceMode.disabled, uniformValues,
                layer.id, bufferData.layoutVertexBuffer, indexBuffer, segments,
                layer.paint, painter.transform.zoom, programConfiguration, dynamicBuffers);
        }
    };

    if (painter.renderPass === pass) {
        const depthMode = painter.depthModeForSublayer(1, painter.renderPass === 'opaque' ? DepthMode.ReadWrite : DepthMode.ReadOnly);
        draw(depthMode, false);
    }

    // Draw stroke
    if (activeElevationType === 'none' && painter.renderPass === 'translucent' && layer.paint.get('fill-antialias')) {
        // If we defined a different color for the fill outline, we are
        // going to ignore the bits in 0x07 and just care about the global
        // clipping mask.
        // Otherwise, we only want to drawFill the antialiased parts that are
        // *outside* the current shape. This is important in case the fill
        // or stroke color is translucent. If we wouldn't clip to outside
        // the current shape, some pixels from the outline stroke overlapped
        // the (non-antialiased) fill.
        const depthMode = painter.depthModeForSublayer(layer.getPaintProperty('fill-outline-color') ? 2 : 0, DepthMode.ReadOnly);
        draw(depthMode, true);
    }
}
