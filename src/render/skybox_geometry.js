// @flow

import {members as skyboxAttributes} from './skybox_attributes.js';
import {SkyboxVertexArray, TriangleIndexArray} from '../data/array_types.js';
import SegmentVector from '../data/segment.js';
import type IndexBuffer from '../gl/index_buffer.js';
import type VertexBuffer from '../gl/vertex_buffer.js';
import type Context from '../gl/context.js';

function addVertex(vertexArray: SkyboxVertexArray, x: number, y: number, z: number) {
    vertexArray.emplaceBack(
        // a_pos
        x,
        y,
        z
    );
}

class SkyboxGeometry {
    vertexArray: SkyboxVertexArray;
    vertexBuffer: VertexBuffer;
    indices: TriangleIndexArray;
    indexBuffer: IndexBuffer;
    segment: SegmentVector;

    constructor(context: Context) {
        this.vertexArray = new SkyboxVertexArray();
        this.indices = new TriangleIndexArray();

        addVertex(this.vertexArray, -1.0, -1.0,  1.0);
        addVertex(this.vertexArray,  1.0, -1.0,  1.0);
        addVertex(this.vertexArray, -1.0,  1.0,  1.0);
        addVertex(this.vertexArray,  1.0,  1.0,  1.0);
        addVertex(this.vertexArray, -1.0, -1.0, -1.0);
        addVertex(this.vertexArray,  1.0, -1.0, -1.0);
        addVertex(this.vertexArray, -1.0,  1.0, -1.0);
        addVertex(this.vertexArray,  1.0,  1.0, -1.0);

        // +x
        this.indices.emplaceBack(5, 1, 3);
        this.indices.emplaceBack(3, 7, 5);
        // -x
        this.indices.emplaceBack(6, 2, 0);
        this.indices.emplaceBack(0, 4, 6);
        // +y
        this.indices.emplaceBack(2, 6, 7);
        this.indices.emplaceBack(7, 3, 2);
        // -y
        this.indices.emplaceBack(5, 4, 0);
        this.indices.emplaceBack(0, 1, 5);
        // +z
        this.indices.emplaceBack(0, 2, 3);
        this.indices.emplaceBack(3, 1, 0);
        // -z
        this.indices.emplaceBack(7, 6, 4);
        this.indices.emplaceBack(4, 5, 7);

        this.vertexBuffer = context.createVertexBuffer(this.vertexArray, skyboxAttributes);
        this.indexBuffer = context.createIndexBuffer(this.indices);

        this.segment = SegmentVector.simpleSegment(0, 0, 36, 12);
    }
}

export default SkyboxGeometry;
