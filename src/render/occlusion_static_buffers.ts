import SegmentVector from '../../src/data/segment';

import {TriangleIndexArray, OcclusionVertexArray} from '../data/array_types';
import IndexBuffer from '../gl/index_buffer';

import VertexBuffer from '../gl/vertex_buffer';
import {occlusionLayout} from './occlusion_attributes';
import Context from '../gl/context';

export class OcclusionBuffers {
    vx: VertexBuffer;
    idx: IndexBuffer;

    segments: SegmentVector;

    constructor(context: Context) {
        const vertices = new OcclusionVertexArray();
        const triangles = new TriangleIndexArray();

        vertices.emplaceBack(-1, -1);
        vertices.emplaceBack(1, -1);
        vertices.emplaceBack(1, 1);
        vertices.emplaceBack(-1, 1);

        const base = 0;
        triangles.emplaceBack(base + 0, base + 1, base + 2);
        triangles.emplaceBack(base + 0, base + 2, base + 3);

        this.segments = SegmentVector.simpleSegment(0, 0, vertices.length, triangles.length);

        this.vx = context.createVertexBuffer(vertices, occlusionLayout.members);
        this.idx = context.createIndexBuffer(triangles);
    }

    destroy() {
        this.vx.destroy();
        this.idx.destroy();
    }
}
