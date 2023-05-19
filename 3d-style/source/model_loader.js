// @flow

import type {Footprint, Mesh, Node, Material, ModelTexture, Sampler} from '../data/model.js';
import type {TextureImage} from '../../src/render/texture.js';
import {Aabb} from '../../src/util/primitives.js';
import Color from '../../src/style-spec/util/color.js';
import type {Vec3} from 'gl-matrix';
import {mat4} from 'gl-matrix';
import {TriangleIndexArray,
    ModelLayoutArray,
    NormalLayoutArray,
    TexcoordLayoutArray,
    Color3fLayoutArray,
    Color4fLayoutArray
} from '../../src/data/array_types.js';
import Point from '@mapbox/point-geometry';
import earcut from 'earcut';

import window from '../../src/util/window.js';
import {warnOnce} from '../../src/util/util.js';
import assert from 'assert';
import GridIndex from 'grid-index';

// From https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#accessor-data-types

/* eslint-disable no-unused-vars */
const GLTF_BYTE = 5120;
const GLTF_UBYTE = 5121;
const GLTF_SHORT = 5122;
const GLTF_USHORT = 5123;
const GLTF_UINT = 5125;
const GLTF_FLOAT = 5126;
/* eslint-enable */

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
        images.push(image);
    }
    return images;
}

function convertTextures(gltf: Object, images: Array<TextureImage>): Array<ModelTexture> {

    const textures: ModelTexture[] = [];
    const gl = window.WebGLRenderingContext;
    const samplersDesc = gltf.json.samplers;
    if (gltf.json.textures) {
        for (const textureDesc of gltf.json.textures) {
            const sampler: Sampler = {magFilter: gl.LINEAR, minFilter: gl.NEAREST, wrapS: gl.REPEAT, wrapT: gl.REPEAT, mipmaps: false};

            if (textureDesc.sampler !== undefined) {
                if (samplersDesc[textureDesc.sampler].magFilter) {
                    sampler.magFilter = samplersDesc[textureDesc.sampler].magFilter;
                }
                if (samplersDesc[textureDesc.sampler].minFilter) {
                    sampler.minFilter = samplersDesc[textureDesc.sampler].minFilter;
                }
                // Enable mipmaps for mipmap minification filtering
                if (sampler.minFilter >= gl.NEAREST_MIPMAP_NEAREST) {
                    sampler.mipmaps = true;
                }
                if (samplersDesc[textureDesc.sampler].wrapS) {
                    sampler.wrapS = samplersDesc[textureDesc.sampler].wrapS;
                }
                if (samplersDesc[textureDesc.sampler].wrapT) {
                    sampler.wrapT = samplersDesc[textureDesc.sampler].wrapT;
                }
            }
            const modelTexture: ModelTexture = {image: images[textureDesc.source], sampler, uploaded: false};

            textures.push(modelTexture);
        }
    }
    return textures;
}

function getBufferData(gltf: Object, accessor: Object) {
    if (accessor.value && accessor.value.length) {
        return accessor.value;
    }
    const bufferView = gltf.json.bufferViews[accessor.bufferView];
    const buffer = gltf.buffers[ bufferView.buffer ];
    const offset = buffer.byteOffset + (accessor.byteOffset || 0) + (bufferView.byteOffset || 0);
    const ArrayType = ArrayTypes[ accessor.componentType ];
    const bufferData = new ArrayType(buffer.arrayBuffer, offset, accessor.count * TypeTable[ accessor.type ]);
    return bufferData;
}

function convertMaterial(materialDesc: Object, textures: Array<ModelTexture>): Material {
    const pbrDesc = materialDesc.pbrMetallicRoughness ? materialDesc.pbrMetallicRoughness : {};
    const material: Material = {};
    const pbrMetallicRoughness = {};

    const color: Color = pbrDesc.baseColorFactor ? new Color(pbrDesc.baseColorFactor[0], pbrDesc.baseColorFactor[1], pbrDesc.baseColorFactor[2], pbrDesc.baseColorFactor[3]) : Color.white;
    pbrMetallicRoughness.baseColorFactor = color;
    pbrMetallicRoughness.metallicFactor = pbrDesc.metallicFactor !== undefined ? pbrDesc.metallicFactor : 1.0;
    pbrMetallicRoughness.roughnessFactor = pbrDesc.roughnessFactor !== undefined ? pbrDesc.roughnessFactor : 1.0;
    material.emissiveFactor = materialDesc.emissiveFactor ? [materialDesc.emissiveFactor[0], materialDesc.emissiveFactor[1], materialDesc.emissiveFactor[2]] : [0, 0, 0];
    material.alphaMode = materialDesc.alphaMode ? materialDesc.alphaMode : 'OPAQUE';
    material.alphaCutoff = materialDesc.alphaCutoff !== undefined ? materialDesc.alphaCutoff : 0.5;

    // Textures
    if (pbrDesc.baseColorTexture) {
        pbrMetallicRoughness.baseColorTexture = textures[pbrDesc.baseColorTexture.index];
    }
    if (pbrDesc.metallicRoughnessTexture) {
        pbrMetallicRoughness.metallicRoughnessTexture = textures[pbrDesc.metallicRoughnessTexture.index];
    }
    if (materialDesc.normalTexture) {
        material.normalTexture = textures[materialDesc.normalTexture.index];
    }
    if (materialDesc.occlusionTexture) {
        material.occlusionTexture = textures[materialDesc.occlusionTexture.index];
    }
    if (materialDesc.emissiveTexture) {
        material.emissionTexture = textures[materialDesc.emissiveTexture.index];
    }

    material.pbrMetallicRoughness = pbrMetallicRoughness;

    // just to make the rendertests the same than native
    if (materialDesc.defined === undefined) {
        material.defined = true;
    }
    return material;
}

function computeCentroid(indexArray: Array<number>, vertexArray: Array<number>): Vec3 {
    const out = [0.0, 0.0, 0.0];
    const indexSize = indexArray.length;
    if (indexSize > 0) {
        for (let i = 0; i < indexSize; i++) {
            const index = indexArray[i] * 3;
            out[0] += vertexArray[index];
            out[1] += vertexArray[index + 1];
            out[2] += vertexArray[index + 2];
        }
        out[0] /= indexSize;
        out[1] /= indexSize;
        out[2] /= indexSize;
    }
    return out;
}

function convertPrimitive(primitive: Object, gltf: Object, textures: Array<ModelTexture>): Mesh {
    const indicesIdx = primitive.indices;
    const attributeMap = primitive.attributes;

    const mesh: Mesh = {};

    // eslint-disable-next-line no-warning-comments
    // TODO: Investigate a better way to pass arrays to StructArrays and avoid the double componentType
    // indices
    mesh.indexArray = new TriangleIndexArray();
    // When loading draco compressed buffers, loader.gl parses the buffer in worker thread and returns parsed
    // array here. TODO: There might be no need to copy element by element to mesh.indexArray.
    const indexAccessor = (typeof indicesIdx === "object") ? indicesIdx : gltf.json.accessors[indicesIdx];
    assert(typeof indicesIdx === "number" || (primitive.extensions && primitive.extensions.hasOwnProperty("KHR_draco_mesh_compression")));
    mesh.indexArray.reserve(indexAccessor.count);
    const indexArrayBuffer = getBufferData(gltf, indexAccessor);
    for (let i = 0;  i < indexAccessor.count; i++) {
        mesh.indexArray.emplaceBack(indexArrayBuffer[i * 3], indexArrayBuffer[i * 3 + 1], indexArrayBuffer[i * 3 + 2]);
    }

    // vertices
    mesh.vertexArray = new ModelLayoutArray();
    const positionAccessor = (typeof attributeMap.POSITION === "object") ? attributeMap.POSITION : gltf.json.accessors[attributeMap.POSITION];
    mesh.vertexArray.reserve(positionAccessor.count);
    const vertexArrayBuffer = getBufferData(gltf, positionAccessor);
    for (let i = 0; i < positionAccessor.count; i++) {
        mesh.vertexArray.emplaceBack(vertexArrayBuffer[i * 3], vertexArrayBuffer[i * 3 + 1], vertexArrayBuffer[i * 3 + 2]);
    }

    // bounding box
    mesh.aabb = new Aabb(positionAccessor.min, positionAccessor.max);
    mesh.centroid = computeCentroid(indexArrayBuffer, vertexArrayBuffer);

    // colors
    if (attributeMap.COLOR_0 !== undefined) {
        const colorAccessor = (typeof attributeMap.COLOR_0 === "object") ? attributeMap.COLOR_0 : gltf.json.accessors[attributeMap.COLOR_0];
        const numElements = TypeTable[ colorAccessor.type ];
        // We only support colors in float and uint8 format for now
        if (colorAccessor.componentType === GLTF_FLOAT) {
            mesh.colorArray = numElements === 3 ? new Color3fLayoutArray() : new Color4fLayoutArray();
            mesh.colorArray.reserve(colorAccessor.count);
            const colorArrayBuffer = getBufferData(gltf, colorAccessor);
            if (numElements === 3) { // vec3f
                for (let i = 0;  i < colorAccessor.count; i++) {
                    mesh.colorArray.emplaceBack(colorArrayBuffer[i * 3], colorArrayBuffer[i * 3 + 1], colorArrayBuffer[i * 3 + 2]);
                }
            } else { // vec4f
                for (let i = 0;  i < colorAccessor.count; i++) {
                    mesh.colorArray.emplaceBack(colorArrayBuffer[i * 4], colorArrayBuffer[i * 4 + 1], colorArrayBuffer[i * 4 + 2], colorArrayBuffer[i * 4 + 3]);
                }
            }
        } else if (colorAccessor.componentType === GLTF_USHORT && numElements === 4) {
            mesh.colorArray = new Color4fLayoutArray();
            mesh.colorArray.resize(colorAccessor.count);
            const colorArrayBuffer = getBufferData(gltf, colorAccessor);
            const norm = 1.0 / 65535;
            const float32Array = ((mesh.colorArray: any): Color4fLayoutArray).float32;
            for (let i = 0;  i < colorArrayBuffer.length * 4; ++i) {
                float32Array[i] = colorArrayBuffer[i] * norm;
            }
        } else {
            warnOnce(`glTF color buffer parsing for accessor ${JSON.stringify(colorAccessor)} is not supported`);
        }
    }

    // normals
    if (attributeMap.NORMAL !== undefined) {
        mesh.normalArray = new NormalLayoutArray();
        const normalAccessor = typeof attributeMap.NORMAL === "object" ? attributeMap.NORMAL : gltf.json.accessors[attributeMap.NORMAL];
        mesh.normalArray.reserve(normalAccessor.count);
        const normalArrayBuffer = getBufferData(gltf, normalAccessor);
        for (let i = 0;  i < normalAccessor.count; i++) {
            mesh.normalArray.emplaceBack(normalArrayBuffer[i * 3], normalArrayBuffer[i * 3 + 1], normalArrayBuffer[i * 3 + 2]);
        }
    }
    // texcoord
    if (attributeMap.TEXCOORD_0 !== undefined && textures.length > 0) {
        mesh.texcoordArray = new TexcoordLayoutArray();
        const texcoordAccessor = typeof attributeMap.TEXCOORD_0 === "object" ? attributeMap.TEXCOORD_0 : gltf.json.accessors[attributeMap.TEXCOORD_0];
        mesh.texcoordArray.reserve(texcoordAccessor.count);
        const texcoordArrayBuffer = getBufferData(gltf, texcoordAccessor);
        for (let i = 0;  i < texcoordAccessor.count; i++) {
            mesh.texcoordArray.emplaceBack(texcoordArrayBuffer[i * 2], texcoordArrayBuffer[i * 2 + 1]);
        }
    }

    // Material
    const materialIdx = primitive.material;
    const materialDesc = materialIdx !== undefined ? gltf.json.materials[materialIdx] : {defined: false};
    mesh.material = convertMaterial(materialDesc, textures);

    // Mapbox mesh features, the name CUSTOM_ATTRIBUTE_3 is coming from loader.gl but instead it should be
    // _FEATURE_RGBA4444
    if (attributeMap.CUSTOM_ATTRIBUTE_3 !== undefined) {
        const featureAccesor = attributeMap.CUSTOM_ATTRIBUTE_3;
        const buffer = featureAccesor.value;
        mesh.featureData = new Uint32Array(buffer.buffer);
    }

    return mesh;
}

function convertMeshes(gltf: Object, textures: Array<ModelTexture>): Array<Array<Mesh>> {
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
    node.matrix = nodeDesc.matrix ? nodeDesc.matrix : mat4.identity([]);
    if (nodeDesc.translation) {
        mat4.translate(node.matrix, node.matrix, [nodeDesc.translation[0], nodeDesc.translation[1], nodeDesc.translation[2]]);
    }
    if (nodeDesc.rotation) {
        const rotation = mat4.fromQuat([], [nodeDesc.rotation[0], nodeDesc.rotation[1], nodeDesc.rotation[2], nodeDesc.rotation[3]]);
        mat4.multiply(node.matrix, node.matrix, rotation);
    }
    if (nodeDesc.scale) {
        mat4.scale(node.matrix, node.matrix, [nodeDesc.scale[0], nodeDesc.scale[1], nodeDesc.scale[2]]);
    }

    if (nodeDesc.extras) {
        node.footprint = convertFootprint(nodeDesc);
    }

    if (nodeDesc.mesh !== undefined) {
        node.meshes = meshes[nodeDesc.mesh];
    }
    if (nodeDesc.extras && nodeDesc.extras.id) {
        node.id = nodeDesc.extras.id;
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

function convertFootprint(desc: Object): ?Footprint {
    if (!desc.extras) {
        return null;
    }

    const groundContainer = desc.extras.ground;
    if (!groundContainer || !Array.isArray(groundContainer) || groundContainer.length === 0) {
        return null;
    }

    const ground = groundContainer[0];
    if (!ground || !Array.isArray(ground) || ground.length === 0) {
        return null;
    }

    // Populate only the vertex list of the footprint mesh.
    const vertices: Array<Point> = [];

    for (const point of ground) {
        if (!Array.isArray(point) || point.length !== 2) {
            continue;
        }

        const x = point[0];
        const y = point[1];

        if (typeof x !== "number" || typeof y !== "number") {
            continue;
        }

        vertices.push(new Point(x, y));
    }

    if (vertices.length > 1 && vertices[vertices.length - 1].equals(vertices[0])) {
        vertices.pop();
    }

    if (vertices.length < 3) {
        return null;
    }

    // Ensure that the vertex list is defined in CW order
    let cross = 0;

    const getTriangleBounds = (out: Array<number>, a: Point, b: Point, c: Point) => {
        out[0] = Math.min(a.x, b.x, c.x);
        out[1] = Math.min(a.y, b.y, c.y);
        out[2] = Math.max(a.x, b.x, c.x);
        out[3] = Math.max(a.y, b.y, c.y);
    };

    const minmax = [Number.MAX_VALUE, Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE];

    for (let i = 0; i < vertices.length; i++) {
        const a = vertices[i];
        const b = vertices[(i + 1) % vertices.length];
        const c = vertices[(i + 2) % vertices.length];

        cross += (a.x - b.x) * (c.y - b.y) - (c.x - b.x) * (a.y - b.y);

        minmax[0] = Math.min(minmax[0], a.x, b.x, c.x);
        minmax[1] = Math.min(minmax[1], a.y, b.y, c.y);
        minmax[2] = Math.max(minmax[2], a.x, b.x, c.x);
        minmax[3] = Math.max(minmax[3], a.y, b.y, c.y);
    }

    if (cross > 0) {
        vertices.reverse();
    }

    // Triangulate the footprint and compute grid acceleration structure for
    // more performant intersection queries.
    const indices = earcut(vertices.flatMap(v => [v.x, v.y]), []);

    const min = new Point(minmax[0], minmax[1]);
    const max = new Point(minmax[2], minmax[3]);
    let gridExtent = Math.max(max.x - min.x, max.y - min.y);

    if (gridExtent === 0)
        gridExtent = 1;

    const grid = new GridIndex(gridExtent, 8, 0);
    const bounds = [];

    for (let i = 0, idx = 0; i < indices.length; i += 3) {
        const v0 = vertices[indices[i + 0]];
        const v1 = vertices[indices[i + 1]];
        const v2 = vertices[indices[i + 2]];

        getTriangleBounds(bounds, v0, v1, v2);
        grid.insert(idx++, bounds[0] - min.x, bounds[1] - min.y, bounds[2] - min.x, bounds[3] - min.y);
    }

    return {
        vertices,
        indices,
        grid,
        min,
        max
    };
}

export default function convertModel(gltf: Object): Array<Node> {
    const images = convertImages(gltf);
    const textures = convertTextures(gltf, images);
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
