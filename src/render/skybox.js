// @flow

import {members as skyboxAttributes} from './skybox_attributes';
import {SkyboxVertexArray, TriangleIndexArray} from '../data/array_types';
import SegmentVector from '../data/segment';
import type IndexBuffer from '../../gl/index_buffer';
import type VertexBuffer from '../../gl/vertex_buffer';
import TextureCubemap from './texture_cubemap';

function addVertex(vertexArray, x, y, z) {
    vertexArray.emplaceBack(
        // a_pos
        x,
        y,
        z
    );
}

class Skybox {
    skyboxVertexArray: SkyboxVertexArray;
    skyboxVertexBuffer: VertexBuffer;
    skyboxIndices: TriangleIndexArray;
    skyboxIndexBuffer: IndexBuffer;
    segment: SegmentVector;
    textureCube: TextureCubemap;

    constructor(context: Context, cubemapFaces: [ImageBitmap]) {
        const gl = context.gl;

        this.skyboxVertexArray = new SkyboxVertexArray();
        this.skyboxIndices = new TriangleIndexArray();

        addVertex(this.skyboxVertexArray, -1.0, -1.0,  1.0);
        addVertex(this.skyboxVertexArray,  1.0, -1.0,  1.0);
        addVertex(this.skyboxVertexArray, -1.0,  1.0,  1.0);
        addVertex(this.skyboxVertexArray,  1.0,  1.0,  1.0);
        addVertex(this.skyboxVertexArray, -1.0, -1.0, -1.0);
        addVertex(this.skyboxVertexArray,  1.0, -1.0, -1.0);
        addVertex(this.skyboxVertexArray, -1.0,  1.0, -1.0);
        addVertex(this.skyboxVertexArray,  1.0,  1.0, -1.0);

        // +x
        this.skyboxIndices.emplaceBack(5, 1, 3);
        this.skyboxIndices.emplaceBack(3, 7, 5);
        // -x
        this.skyboxIndices.emplaceBack(6, 2, 0);
        this.skyboxIndices.emplaceBack(0, 4, 6);
        // +y
        this.skyboxIndices.emplaceBack(2, 6, 7);
        this.skyboxIndices.emplaceBack(7, 3, 2);
        // -y
        this.skyboxIndices.emplaceBack(5, 4, 0);
        this.skyboxIndices.emplaceBack(0, 1, 5);
        // +z
        this.skyboxIndices.emplaceBack(0, 2, 3);
        this.skyboxIndices.emplaceBack(3, 1, 0);
        // -z
        this.skyboxIndices.emplaceBack(7, 6, 4);
        this.skyboxIndices.emplaceBack(4, 5, 7);

        this.skyboxVertexBuffer = context.createVertexBuffer(this.skyboxVertexArray, skyboxAttributes);
        this.skyboxIndexBuffer = context.createIndexBuffer(this.skyboxIndices);

        this.segment = SegmentVector.simpleSegment(0, 0, 36, 12);

        this.textureCube = new TextureCubemap(context, cubemapFaces, gl.RGBA)
    }
}

export default Skybox;