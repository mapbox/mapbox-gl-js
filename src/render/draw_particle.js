// @flow

import StencilMode from '../gl/stencil_mode.js';
import DepthMode from '../gl/depth_mode.js';
import CullFaceMode from '../gl/cull_face_mode.js';
import Program from './program.js';
import {particleUniformValues, particleDefinesValues} from './program/particle_program.js';
import SegmentVector from '../data/segment.js';
import {OverscaledTileID} from '../source/tile_id.js';
import ColorMode from '../gl/color_mode.js';
import ImageSource, { globalTexture } from '../source/image_source.js';
import { globalSystem } from '../data/particle_system.js';
import {createLayout} from '../util/struct_array.js';
import {ParticleInstanceArray} from '../data/array_types.js';

import type Painter from './painter.js';
import type SourceCache from '../source/source_cache.js';
import type CircleStyleLayer from '../style/style_layer/circle_style_layer.js';
import type ParticleBucket from '../data/bucket/particle_bucket.js';
import type ProgramConfiguration from '../data/program_configuration.js';
import type VertexBuffer from '../gl/vertex_buffer.js';
import type IndexBuffer from '../gl/index_buffer.js';
import type {UniformValues} from './uniform_binding.js';
import type {ParticleUniformsType} from './program/particle_program.js';
import type Tile from '../source/tile.js';
import type {DynamicDefinesType} from './program/program_uniforms.js';

export default drawParticles;

type TileRenderState = {
    programConfiguration: ProgramConfiguration,
    program: Program<*>,
    layoutVertexBuffer: VertexBuffer,
    indexBuffer: IndexBuffer,
    uniformValues: UniformValues<ParticleUniformsType>,
    tile: Tile
};

const instanceLayout = createLayout([
    {name: 'a_offset_and_scale', components: 4, type: 'Float32'},
    {name: 'a_particle_color', components: 4, type: 'Float32'}
], 4);

function drawParticles(painter: Painter, sourceCache: SourceCache, layer: CircleStyleLayer, coords: Array<OverscaledTileID>) {
    if (painter.renderPass !== 'translucent') return;

    const cloudMode = layer.paint.get('particle-emitter-type') === 'cloud';
    const opacity = layer.paint.get('particle-opacity');
    const sortFeaturesByKey = layer.layout.get('particle-sort-key').constantOr(1) !== undefined;

    if (opacity.constantOr(1) === 0 ) {
        return;
    }

    const context = painter.context;
    const gl = context.gl;

    const depthMode = painter.depthModeForSublayer(0, DepthMode.ReadOnly);
    // Turn off stencil testing to allow circles to be drawn across boundaries,
    // so that large circles are not clipped to tiles
    const stencilMode = StencilMode.disabled;
    const colorMode = cloudMode ? ColorMode.alphaBlended : ColorMode.additiveBlended;

    let particleCount = 0;
    const particlePositions = [];
    const tileParticleRanges = [];

    for (const coord of coords) {
        const start = particleCount;

        const tile = sourceCache.getTile(coord);
        const bucket: ?ParticleBucket<*> = (tile.getBucket(layer): any);

        if (!bucket) continue;

        for (const feature of bucket.features) {
            globalSystem.addEmitter(undefined, feature.point, feature.tileId, feature.mercatorPoint, layer.paint);
        }

        globalSystem.update();

        for (var emitter of globalSystem.emitters) {
            if (!emitter.tileId.equals(bucket.tileId)) {
                continue;
            }
            if (emitter.paint.get('particle-emitter-type') != layer.paint.get('particle-emitter-type')) {
                continue;
            }
            for (const particle of emitter.particles) {
                particleCount += 1;
                particlePositions.push([
                    emitter.location.x + emitter.zoom * particle.locationOffset.x, 
                    emitter.location.y + emitter.zoom * particle.locationOffset.y, 
                    emitter.elevation + particle.locationOffset.z,
                    particle.scale,
                    particle.color.r,
                    particle.color.g,
                    particle.color.b,
                    particle.opacity
                ]);
            }
        }

        tileParticleRanges.push({start: start, count: particleCount - start});
    }

    const tileParticleBuffers = [];

    for (const tileRange of tileParticleRanges) {
        // Create instance data

        const instanceArray = new ParticleInstanceArray();

        for (let i = 0; i < tileRange.count; ++i) {
            instanceArray.emplaceBack(
                particlePositions[tileRange.start + i][0],
                particlePositions[tileRange.start + i][1],
                particlePositions[tileRange.start + i][2],
                particlePositions[tileRange.start + i][3],
                particlePositions[tileRange.start + i][4],
                particlePositions[tileRange.start + i][5],
                particlePositions[tileRange.start + i][6],
                particlePositions[tileRange.start + i][7]);
        }

        const positionBuffer = context.createVertexBuffer(instanceArray, instanceLayout.members);
        tileParticleBuffers.push(positionBuffer);
    }

    let validTileIndex = 0;
    for (let i = 0; i < coords.length; i++) {
        const coord = coords[i];
        const tile = sourceCache.getTile(coord);
        const bucket: ?ParticleBucket<*> = (tile.getBucket(layer): any);
        if (!bucket) continue;

        const programConfiguration = bucket.programConfigurations.get(layer.id);
        const definesValues = particleDefinesValues(layer);
        
        const program = painter.useProgram('particle', programConfiguration, ((definesValues: any): DynamicDefinesType[]));
        const layoutVertexBuffer = bucket.layoutVertexBuffer;
        const indexBuffer = bucket.indexBuffer;

        const uniformValues = particleUniformValues(painter, coord, tile, layer);
            
        program.drawInstanced(context, gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.disabled,
            uniformValues, layer.id,
            layoutVertexBuffer, indexBuffer, bucket.segments, tileParticleRanges[validTileIndex].count,
            layer.paint, painter.transform.zoom, programConfiguration, tileParticleBuffers[validTileIndex]);

        validTileIndex += 1;
    }

}
