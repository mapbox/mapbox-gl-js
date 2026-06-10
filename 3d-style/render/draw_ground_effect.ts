import EXTENT from '../../src/style-spec/data/extent';
import {neighborCoord} from '../../src/source/tile_id';
import {getCutoffParams} from '../../src/render/cutoff';
import {mat4} from 'gl-matrix';
import {
    Uniform1i,
    Uniform1f,
    Uniform2f,
    Uniform3f,
    UniformMatrix4f,
} from '../../src/render/uniform_binding';
import assert from '../../src/style-spec/util/assert';

import type CullFaceMode from '../../src/gl/cull_face_mode';
import type ColorMode from '../../src/gl/color_mode';
import type StencilMode from '../../src/gl/stencil_mode';
import type DepthMode from '../../src/gl/depth_mode';
import type Context from '../../src/gl/context';
import type Painter from '../../src/render/painter';
import type SourceCache from '../../src/source/source_cache';
import type {UniformValues} from '../../src/render/uniform_binding';
import type {OverscaledTileID} from '../../src/source/tile_id';
import type Texture from '../../src/render/texture';
import type {GroundEffect} from '../../src/data/bucket/fill_extrusion_bucket';
import type SegmentVector from '../../src/data/segment';
import type {TypedStyleLayer} from '../../src/style/style_layer/typed_style_layer';
import type {BucketWithGroundEffect, GroundEffectProperties} from '../../src/render/draw_fill_extrusion';
import type VertexBuffer from '../../src/gl/vertex_buffer';
import type {DynamicDefinesType} from '../../src/render/program/program_uniforms';

export type FillExtrusionGroundEffectUniformsType = {
    ['u_matrix']: UniformMatrix4f;
    ['u_opacity']: Uniform1f;
    ['u_ao_pass']: Uniform1f;
    ['u_meter_to_tile']: Uniform1f;
    ['u_ao']: Uniform2f;
    ['u_flood_light_intensity']: Uniform1f;
    ['u_flood_light_color']: Uniform3f;
    ['u_attenuation']: Uniform1f;
    ['u_edge_radius']: Uniform1f;
    ['u_fb']: Uniform1i;
    ['u_fb_size']: Uniform1f;
    ['u_dynamic_offset']: Uniform1f;
};

export const fillExtrusionGroundEffectUniforms = (context: Context): FillExtrusionGroundEffectUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_opacity': new Uniform1f(context),
    'u_ao_pass': new Uniform1f(context),
    'u_meter_to_tile': new Uniform1f(context),
    'u_ao': new Uniform2f(context),
    'u_flood_light_intensity': new Uniform1f(context),
    'u_flood_light_color': new Uniform3f(context),
    'u_attenuation': new Uniform1f(context),
    'u_edge_radius': new Uniform1f(context),
    'u_fb': new Uniform1i(context),
    'u_fb_size': new Uniform1f(context),
    'u_dynamic_offset': new Uniform1f(context),
});

export const fillExtrusionGroundEffectUniformValues = (
    matrix: mat4,
    opacity: number,
    aoPass: boolean,
    meterToTile: number,
    ao: [number, number],
    floodLightIntensity: number,
    floodLightColor: [number, number, number],
    attenuation: number,
    edgeRadius: number,
    fbSize: number,
): UniformValues<FillExtrusionGroundEffectUniformsType> => ({
    'u_matrix': matrix,
    'u_opacity': opacity,
    'u_ao_pass': aoPass ? 1 : 0,
    'u_meter_to_tile': meterToTile,
    'u_ao': ao,
    'u_flood_light_intensity': floodLightIntensity,
    'u_flood_light_color': floodLightColor,
    'u_attenuation': attenuation,
    'u_edge_radius': edgeRadius,
    'u_fb': 0,
    'u_fb_size': fbSize,
    'u_dynamic_offset': 1,
});

// Scratch buffer reused across neighbour iterations in the ground-effect loop; safe because
// the matrix is consumed synchronously by program.draw (UniformMatrix4f caches a copy).
const neighborProjScratch = new Float32Array(16);

type GroundEffectSubpassType = 'clear' | 'sdf' | 'color' | 'emissive';

export function drawGroundEffect<StyleLayerType extends TypedStyleLayer>(props: GroundEffectProperties, painter: Painter, source: SourceCache, layer: StyleLayerType, coords: Array<OverscaledTileID>, depthMode: DepthMode, stencilMode: StencilMode, colorMode: ColorMode, cullFaceMode: CullFaceMode, aoPass: boolean, subpass: GroundEffectSubpassType, opacity: number, aoIntensity: number, aoRadius: number, floodLightIntensity: number, floodLightColor: [number, number, number], attenuation: number, replacementActive: boolean, renderNeighbors: boolean, framebufferCopyTexture?: Texture | null, frontCutoffParams?: [number, number, number]) {
    const context = painter.context;
    const gl = context.gl;
    const tr = painter.transform;
    const zoom = painter.transform.zoom;
    const defines: Array<DynamicDefinesType> = [];

    const paintPropertyTranslate = props.translate;
    const paintPropertyTranslateAnchor = props.translateAnchor;
    const edgeRadius = props.edgeRadius;
    const cutoffParams = getCutoffParams(painter, props.cutoffFadeRange);

    if (subpass === 'clear') {
        defines.push('CLEAR_SUBPASS');
        if (framebufferCopyTexture) {
            defines.push('CLEAR_FROM_TEXTURE');
            context.activeTexture.set(gl.TEXTURE0);
            framebufferCopyTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
        }
    } else if (subpass === 'sdf') {
        defines.push('SDF_SUBPASS');
    } else if (subpass === 'emissive') {
        defines.push('USE_MRT1');
        context.activeTexture.set(gl.TEXTURE0);
        framebufferCopyTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
    }
    if (replacementActive) {
        defines.push('HAS_CENTROID');
    }
    if (cutoffParams.shouldRenderCutoff) {
        defines.push('RENDER_CUTOFF');
    }

    const renderGroundEffectTile = (coord: OverscaledTileID, groundEffect: GroundEffect, segments: SegmentVector, matrix: mat4, meterToTile: number) => {
        let programDefines = defines;
        if (groundEffect.groundRadiusBuffer != null) {
            programDefines = defines.concat('HAS_ATTRIBUTE_a_flood_light_ground_radius');
        }

        const programConfiguration = groundEffect.programConfigurations.get(layer.id);
        const affectedByFog = painter.isTileAffectedByFog(coord);
        const program = painter.getOrCreateProgram('fillExtrusionGroundEffect', {config: programConfiguration, defines: programDefines, overrideFog: affectedByFog});

        const ao: [number, number] = [aoIntensity, aoRadius * meterToTile];

        const edgeRadiusTile = zoom >= 17 ? 0 : edgeRadius * meterToTile;
        const fbSize = framebufferCopyTexture ? framebufferCopyTexture.size[0] : 0;
        const uniformValues = fillExtrusionGroundEffectUniformValues(matrix, opacity, aoPass, meterToTile, ao, floodLightIntensity, floodLightColor, attenuation, edgeRadiusTile, fbSize);

        const dynamicBuffers: Array<VertexBuffer | null | undefined> = [];
        if (replacementActive) dynamicBuffers.push(groundEffect.hiddenByLandmarkVertexBuffer);

        if (groundEffect.groundRadiusBuffer != null) {
            dynamicBuffers.push(groundEffect.groundRadiusBuffer);
        }
        painter.uploadCommonUniforms(context, program, coord.toUnwrapped(), null, cutoffParams);

        program.draw(painter, context.gl.TRIANGLES, depthMode, stencilMode, colorMode, cullFaceMode,
            uniformValues, layer.id, groundEffect.vertexBuffer, groundEffect.indexBuffer,
            segments, layer.paint, zoom,
            programConfiguration, dynamicBuffers);
    };

    for (const coord of coords) {
        const tile = source.getTile(coord);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
        const bucket: BucketWithGroundEffect | null | undefined = (tile.getBucket(layer) as any);
        if (!bucket || bucket.projection.name !== tr.projection.name || !bucket.groundEffect || (bucket.groundEffect && !bucket.groundEffect.hasData())) continue;

        const groundEffect = bucket.groundEffect;
        const meterToTile = 1 / bucket.tileToMeter;
        {
            const matrix = painter.translatePosMatrix(
                coord.projMatrix,
                tile,

                paintPropertyTranslate,
                paintPropertyTranslateAnchor);

            const segments = groundEffect.getDefaultSegment();
            renderGroundEffectTile(coord, groundEffect, segments, matrix, meterToTile);
        }

        if (renderNeighbors) {
            for (let i = 0; i < 4; i++) {
                const nCoord = neighborCoord[i](coord);
                const nTile = source.getTile(nCoord);
                if (!nTile) continue;

                const nBucket = nTile.getBucket(layer) as BucketWithGroundEffect;
                if (!nBucket || nBucket.projection.name !== tr.projection.name || !nBucket.groundEffect || (nBucket.groundEffect && !nBucket.groundEffect.hasData())) continue;

                const nGroundEffect = nBucket.groundEffect;
                assert(nGroundEffect.regionSegments);

                let translation: [number, number, number];
                let regionId: number;
                if (i === 0) { // left
                    translation = [-EXTENT, 0, 0];
                    regionId = 1;
                } else if (i === 1) { // right
                    translation = [EXTENT, 0, 0];
                    regionId = 0;
                } else if (i === 2) { // top
                    translation = [0, -EXTENT, 0];
                    regionId = 3;
                } else { // bottom
                    translation = [0, EXTENT, 0];
                    regionId = 2;
                }

                const segments = nGroundEffect.regionSegments[regionId];
                // No geometry from the neighbour tile intersects the current tile.
                if (!segments) continue;

                mat4.translate(neighborProjScratch, coord.projMatrix, translation);
                const matrix = painter.translatePosMatrix(
                    neighborProjScratch,
                    tile,

                    paintPropertyTranslate,
                    paintPropertyTranslateAnchor);
                renderGroundEffectTile(coord, nGroundEffect, segments, matrix, meterToTile);
            }
        }
    }
}
