import StencilMode from '../gl/stencil_mode';
import DepthMode from '../gl/depth_mode';
import CullFaceMode from '../gl/cull_face_mode';
import Program from './program';
import {circleUniformValues, circleDefinesValues} from './program/circle_program';
import SegmentVector from '../data/segment';
import {OverscaledTileID} from '../source/tile_id';
import {mercatorXfromLng, mercatorYfromLat} from '../geo/mercator_coordinate';

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type CircleStyleLayer from '../style/style_layer/circle_style_layer';
import type CircleBucket from '../data/bucket/circle_bucket';
import type ProgramConfiguration from '../data/program_configuration';
import type VertexBuffer from '../gl/vertex_buffer';
import type IndexBuffer from '../gl/index_buffer';
import type {UniformValues} from './uniform_binding';
import type {CircleUniformsType} from './program/circle_program';
import type Tile from '../source/tile';
import type {DynamicDefinesType} from './program/program_uniforms';

export default drawCircles;

type TileRenderState = {
    programConfiguration: ProgramConfiguration;
    program: Program<any>;
    layoutVertexBuffer: VertexBuffer;
    globeExtVertexBuffer: VertexBuffer | null | undefined;
    indexBuffer: IndexBuffer;
    uniformValues: UniformValues<CircleUniformsType>;
    tile: Tile;
};

type SegmentsTileRenderState = {
    segments: SegmentVector;
    sortKey: number;
    state: TileRenderState;
};

function drawCircles(painter: Painter, sourceCache: SourceCache, layer: CircleStyleLayer, coords: Array<OverscaledTileID>) {
    if (painter.renderPass !== 'translucent') return;

    const opacity = layer.paint.get('circle-opacity');
    const strokeWidth = layer.paint.get('circle-stroke-width');
    const strokeOpacity = layer.paint.get('circle-stroke-opacity');

    const sortFeaturesByKey = layer.layout.get('circle-sort-key').constantOr(1) !== undefined;
    const emissiveStrength = layer.paint.get('circle-emissive-strength');

    if (opacity.constantOr(1) === 0 && (strokeWidth.constantOr(1) === 0 || strokeOpacity.constantOr(1) === 0)) {
        return;
    }

    const context = painter.context;
    const gl = context.gl;
    const tr = painter.transform;

    const depthMode = painter.depthModeForSublayer(0, DepthMode.ReadOnly);
    // Turn off stencil testing to allow circles to be drawn across boundaries,
    // so that large circles are not clipped to tiles
    const stencilMode = StencilMode.disabled;

    const colorMode = painter.colorModeForDrapableLayerRenderPass(emissiveStrength);
    const isGlobeProjection = tr.projection.name === 'globe';
    const mercatorCenter = [mercatorXfromLng(tr.center.lng), mercatorYfromLat(tr.center.lat)];

    const segmentsRenderStates: Array<SegmentsTileRenderState> = [];

    for (let i = 0; i < coords.length; i++) {
        const coord = coords[i];

        const tile = sourceCache.getTile(coord);
        const bucket: CircleBucket<any> | null | undefined = (tile.getBucket(layer) as any);
        if (!bucket || bucket.projection.name !== tr.projection.name) continue;

        const programConfiguration = bucket.programConfigurations.get(layer.id);
        const definesValues = (circleDefinesValues(layer) as DynamicDefinesType[]);
        const affectedByFog = painter.isTileAffectedByFog(coord);
        if (isGlobeProjection) {
            definesValues.push('PROJECTION_GLOBE_VIEW');
        }
        const program = painter.getOrCreateProgram('circle', {config: programConfiguration, defines: definesValues, overrideFog: affectedByFog});
        const layoutVertexBuffer = bucket.layoutVertexBuffer;
        const globeExtVertexBuffer = bucket.globeExtVertexBuffer;
        const indexBuffer = bucket.indexBuffer;
        const invMatrix = tr.projection.createInversionMatrix(tr, coord.canonical);
        // @ts-expect-error - TS2345 - Argument of type 'number[]' is not assignable to parameter of type '[number, number]'.
        const uniformValues = circleUniformValues(painter, coord, tile, invMatrix, mercatorCenter, layer);

        const state: TileRenderState = {
            programConfiguration,
            program,
            layoutVertexBuffer,
            globeExtVertexBuffer,
            indexBuffer,
            uniformValues,
            tile
        };

        if (sortFeaturesByKey) {
            const oldSegments = bucket.segments.get();
            for (const segment of oldSegments) {
                segmentsRenderStates.push({
                    segments: new SegmentVector([segment]),
                    sortKey: (segment.sortKey),
                    state
                });
            }
        } else {
            segmentsRenderStates.push({
                segments: bucket.segments,
                sortKey: 0,
                state
            });
        }

    }

    if (sortFeaturesByKey) {
        segmentsRenderStates.sort((a, b) => a.sortKey - b.sortKey);
    }

    const terrainOptions = {useDepthForOcclusion: tr.depthOcclusionForSymbolsAndCircles};

    for (const segmentsState of segmentsRenderStates) {
        const {programConfiguration, program, layoutVertexBuffer, globeExtVertexBuffer, indexBuffer, uniformValues, tile} = segmentsState.state;
        const segments = segmentsState.segments;

        if (painter.terrain) painter.terrain.setupElevationDraw(tile, program, terrainOptions);

        painter.uploadCommonUniforms(context, program, tile.tileID.toUnwrapped());

        program.draw(painter, gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.disabled,
            uniformValues, layer.id, layoutVertexBuffer, indexBuffer, segments,
            layer.paint, tr.zoom, programConfiguration, [globeExtVertexBuffer]);
    }
}
