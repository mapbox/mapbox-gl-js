// @flow

import type {Mesh, Node, Material} from '../data/model.js';
import Texture from '../../src/render/texture.js';
import type {TextureImage} from '../../src/render/texture.js';
import type Context from '../../src/gl/context.js';
import {Aabb} from '../../src/util/primitives.js';
import {mat4} from 'gl-matrix';
import {TriangleIndexArray, ModelLayoutArray, NormalLayoutArray, TexcoordLayoutArray} from '../../src/data/array_types.js';

// From https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#accessor-data-types
const ArrayTypes = {
    "5120": Int8Array,
    "5121": Uint8Array,
    "5122": Int16Array,
    "5123": Uint16Array,
    "5125": Uint32Array,
    "5126": Float32Array
};

const TypeTable = {
    SCALAR: 1,
    VEC2: 2,
    VEC3: 3,
    VEC4: 4,
    MAT2: 4,
    MAT3: 9,
    MAT4: 16
};

function convertImages(gltf: Object): Array<TextureImage> {

    const images: TextureImage[] = [];
    for (const image of gltf.images) {
        // eslint-disable-next-line no-warning-comments
        // TODO: Handle alpha images?
        images.push(image);
    }
    return images;
}

function convertTextures(gltf: Object, images: Array<TextureImage>, context: Context): Array<Texture> {

    const textures: Texture[] = [];
    if (gltf.json.textures) {
        for (const textureDesc of gltf.json.textures) {
            const texture = new Texture(context, images[textureDesc.source], context.gl.RGBA);
            // eslint-disable-next-line no-warning-comments
            // TODO: Texture filter needs mag/min differentiation
            texture.filter = gltf.json.samplers[textureDesc.sampler].minFilter;
            // eslint-disable-next-line no-warning-comments
            // TODO: Texture wrap needs wrapS/wrapT differentiation
            texture.wrap = gltf.json.samplers[textureDesc.sampler].wrapS;
            textures.push(texture);
        }
    }
    return textures;
}

function getBufferData(gltf: Object, accessor: Object) {
    const bufferView = gltf.json.bufferViews[accessor.bufferView];
    const buffer = gltf.buffers[ bufferView.buffer ];
    const offset = accessor.byteOffset + bufferView.byteOffset;
    const ArrayType = ArrayTypes[ accessor.componentType ];
    const bufferData = new ArrayType(buffer.arrayBuffer, offset, accessor.count * TypeTable[ accessor.type ]);
    return bufferData;
}

function convertPrimitive(primitive: Object, gltf: Object, textures: Array<Texture>): Mesh {
    const indicesIdx = primitive.indices;
    const attributeMap = primitive.attributes;

    const mesh: Mesh = {};

    // eslint-disable-next-line no-warning-comments
    // TODO: Investigate a better way to pass arrays to StructArrays and avoid the double copy

    // indices
    mesh.indexArray = new TriangleIndexArray();
    const indexAccessor = gltf.json.accessors[indicesIdx];
    mesh.indexArray.reserve(indexAccessor.count);
    const indexArrayBuffer = getBufferData(gltf, indexAccessor);
    for (let i = 0;  i < indexAccessor.count; i++) {
        mesh.indexArray.emplaceBack(indexArrayBuffer[i * 3], indexArrayBuffer[i * 3 + 1], indexArrayBuffer[i * 3 + 2]);
    }

    // vertices
    mesh.vertexArray = new ModelLayoutArray();
    const positionAccessor = gltf.json.accessors[attributeMap.POSITION];
    mesh.vertexArray.reserve(positionAccessor.count);
    const vertexArrayBuffer = getBufferData(gltf, positionAccessor);
    for (let i = 0; i < positionAccessor.count; i++) {
        mesh.vertexArray.emplaceBack(vertexArrayBuffer[i * 3], vertexArrayBuffer[i * 3 + 1], vertexArrayBuffer[i * 3 + 2]);
    }

    // compute bounding box
    mesh.aabb = new Aabb(positionAccessor.min, positionAccessor.max);

    // normals
    if (attributeMap.NORMAL) {
        mesh.normalArray = new NormalLayoutArray();
        const normalAccessor = gltf.json.accessors[attributeMap.NORMAL];
        mesh.normalArray.reserve(normalAccessor.count);
        const normalArrayBuffer = getBufferData(gltf, normalAccessor);
        for (let i = 0;  i < normalAccessor.count; i++) {
            mesh.normalArray.emplaceBack(normalArrayBuffer[i * 3], normalArrayBuffer[i * 3 + 1], normalArrayBuffer[i * 3 + 2]);
        }
    }
    // texcoord
    if (attributeMap.TEXCOORD_0) {
        mesh.texcoordArray = new TexcoordLayoutArray();
        const texcoordAccessor = gltf.json.accessors[attributeMap.TEXCOORD_0];
        mesh.texcoordArray.reserve(texcoordAccessor.count);
        const texcoordArrayBuffer = getBufferData(gltf, texcoordAccessor);
        for (let i = 0;  i < texcoordAccessor.count; i++) {
            mesh.texcoordArray.emplaceBack(texcoordArrayBuffer[i * 2], texcoordArrayBuffer[i * 2 + 1]);
        }
    }

    const materialIdx = primitive.material;
    const materialDesc = gltf.json.materials[materialIdx];
    const pbrMetallicRoughness = {};
    if (materialDesc.pbrMetallicRoughness.baseColorTexture) {
        pbrMetallicRoughness.baseColorTexture = textures[materialDesc.pbrMetallicRoughness.baseColorTexture.index];
    }

    const material: Material = {};
    material.pbrMetallicRoughness = pbrMetallicRoughness;
    mesh.material = material;

    // eslint-disable-next-line no-warning-comments
    // TODO: Compute centroid
    return mesh;
}

function convertMeshes(gltf: Object, textures: Array<Texture>): Array<Array<Mesh>> {
    const meshes: Mesh[][] = [];
    for (const meshDesc of gltf.json.meshes) {
        const primitives: Mesh[] = [];
        for (const primitive of meshDesc.primitives) {
            const mesh = convertPrimitive(primitive, gltf, textures);
            primitives.push(mesh);
        }
        meshes.push(primitives);
    }
    return meshes;
}

function convertNode(nodeDesc: Object, gltf: Object, meshes: Array<Array<Mesh>>): Node {
    const node: Node = {};
    // eslint-disable-next-line no-warning-comments
    // TODO: support trans + rot + scale if no matrix
    node.matrix = nodeDesc.matrix ? nodeDesc.matrix : mat4.identity([]);
    if (nodeDesc.mesh !== undefined) {
        node.meshes = meshes[nodeDesc.mesh];
    }
    if (nodeDesc.children) {
        const children: Node[] = [];
        for (const childNodeIdx of nodeDesc.children) {
            const childNodeDesc = gltf.json.nodes[childNodeIdx];
            children.push(convertNode(childNodeDesc, gltf, meshes));
        }
        node.children = children;
    }
    return node;
}

export default function convertModel(gltf: Object, context: Context): Array<Node> {
    const images = convertImages(gltf);
    const textures = convertTextures(gltf, images, context);
    const meshes = convertMeshes(gltf, textures);
    const nodes: Node[] = [];

    // select the correct node hierarchy
    const scene = gltf.json.scene ? gltf.json.scenes[gltf.json.scene] : gltf.json.scenes ? gltf.json.scenes[0] : undefined;
    const gltfNodes = scene ? scene.nodes : gltf.json.nodes;

    for (const nodeIdx of gltfNodes) {
        const nodeDesc = gltf.json.nodes[nodeIdx];
        nodes.push(convertNode(nodeDesc, gltf, meshes));
    }
    return nodes;
}
