import StencilMode from '../gl/stencil_mode';
import DepthMode from '../gl/depth_mode';
import {default as ColorMode} from '../gl/color_mode';
import CullFaceMode from '../gl/cull_face_mode';
import SegmentVector from '../data/segment';
import {TriangleIndexArray, VignetteVertexArray} from '../data/array_types';
import {vignetteUniformValues} from './vignette_program';
import {vignetteLayout} from "./vignette_attributes";

import type Painter from '../render/painter';
import type IndexBuffer from '../gl/index_buffer';
import type VertexBuffer from '../gl/vertex_buffer';

export type VignetteParams = {
    strength: number,
    start: number,
    range: number,
    fadePower: number,
    color: {r: number, g: number, b: number, a: number},
};

export function createTpBindings(params: VignetteParams, painter: Painter, scope: string[]) {
    const tp = painter.tp;

    tp.registerParameter(params, scope, 'start', {min: 0.0, max: 2.0});
    tp.registerParameter(params, scope, 'range', {min: 0.0, max: 2.0});
    tp.registerParameter(params, scope, 'fadePower', {min: -1.0, max: 1.0, step: 0.01});
    tp.registerParameter(params, scope, 'strength', {min: 0.0, max: 1.0});
    tp.registerParameter(params, scope, 'color', {
        color: {type: 'float'},
    });
}

export class Vignette {
    vignetteVx: VertexBuffer | null | undefined;
    vignetteIdx: IndexBuffer | null | undefined;

    destroy() {
        if (this.vignetteVx) {
            this.vignetteVx.destroy();
        }
        if (this.vignetteIdx) {
            this.vignetteIdx.destroy();
        }
    }

    draw(painter: Painter, params: VignetteParams) {
        const program = painter.getOrCreateProgram('vignette');

        if (!this.vignetteVx || !this.vignetteIdx) {
            const vertices = new VignetteVertexArray();
            const triangles = new TriangleIndexArray();

            vertices.emplaceBack(-1, -1);
            vertices.emplaceBack(1, -1);
            vertices.emplaceBack(1, 1);
            vertices.emplaceBack(-1, 1);

            triangles.emplaceBack(0, 1, 2);
            triangles.emplaceBack(0, 2, 3);

            this.vignetteVx = painter.context.createVertexBuffer(vertices, vignetteLayout.members);
            this.vignetteIdx = painter.context.createIndexBuffer(triangles);
        }

        const vignetteSegments = SegmentVector.simpleSegment(0, 0, 4, 6);

        if (this.vignetteVx && this.vignetteIdx) {
            painter.uploadCommonUniforms(painter.context, program);

            const uniforms = vignetteUniformValues({
                vignetteShape: [params.start, params.range, Math.pow(10.0, params.fadePower)],
                vignetteColor: [params.color.r, params.color.g, params.color.b, params.color.a * params.strength],
            });

            const gl = painter.context.gl;

            program.draw(painter, gl.TRIANGLES, DepthMode.disabled, StencilMode.disabled,
                    ColorMode.alphaBlended, CullFaceMode.disabled, uniforms, "vignette",
                    this.vignetteVx, this.vignetteIdx, vignetteSegments);
        }
    }
}
