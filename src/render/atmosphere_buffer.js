// @flow
import type IndexBuffer from '../gl/index_buffer.js';
import type VertexBuffer from '../gl/vertex_buffer.js';
import SegmentVector from '../data/segment.js';
import type Context from '../gl/context.js';
import {atmosphereLayout} from './atmosphere_attributes.js';
import {TriangleIndexArray, AtmosphereVertexArray} from '../data/array_types.js';

export class AtmosphereBuffer {
    vertexBuffer: VertexBuffer;
    indexBuffer: IndexBuffer;
    segments: SegmentVector;

    constructor(context: Context) {
        const vertices = new AtmosphereVertexArray();
        vertices.emplaceBack(-1, 1, 1, 0, 0);
        vertices.emplaceBack(1, 1, 1, 1, 0);
        vertices.emplaceBack(1, -1, 1, 1, 1);
        vertices.emplaceBack(-1, -1, 1, 0, 1);

        const triangles = new TriangleIndexArray();
        triangles.emplaceBack(0, 1, 2);
        triangles.emplaceBack(2, 3, 0);

        this.vertexBuffer = context.createVertexBuffer(vertices, atmosphereLayout.members);
        this.indexBuffer = context.createIndexBuffer(triangles);
        this.segments = SegmentVector.simpleSegment(0, 0, 4, 2);
    }

    destroy() {
        this.vertexBuffer.destroy();
        this.indexBuffer.destroy();
        this.segments.destroy();
    }
}
