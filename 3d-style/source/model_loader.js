// @flow

import type {Footprint, Mesh, Node, Material, ModelTexture, Sampler, AreaLight} from '../data/model.js';
import type {TextureImage} from '../../src/render/texture.js';
import {Aabb} from '../../src/util/primitives.js';
import Color from '../../src/style-spec/util/color.js';
import type {Vec2, Vec3} from 'gl-matrix';
import {mat4, vec3} from 'gl-matrix';
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
import {warnOnce, base64DecToArr} from '../../src/util/util.js';
import assert from 'assert';
import TriangleGridIndex from '../../src/util/triangle_grid_index.js';

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
    const numTriangles = indexAccessor.count / 3;
    mesh.indexArray.reserve(numTriangles);
    const indexArrayBuffer = getBufferData(gltf, indexAccessor);
    for (let i = 0; i < numTriangles; i++) {
        mesh.indexArray.emplaceBack(indexArrayBuffer[i * 3], indexArrayBuffer[i * 3 + 1], indexArrayBuffer[i * 3 + 2]);
    }
    mesh.indexArray._trim();
    // vertices
    mesh.vertexArray = new ModelLayoutArray();
    const positionAccessor = (typeof attributeMap.POSITION === "object") ? attributeMap.POSITION : gltf.json.accessors[attributeMap.POSITION];
    mesh.vertexArray.reserve(positionAccessor.count);
    const vertexArrayBuffer = getBufferData(gltf, positionAccessor);
    for (let i = 0; i < positionAccessor.count; i++) {
        mesh.vertexArray.emplaceBack(vertexArrayBuffer[i * 3], vertexArrayBuffer[i * 3 + 1], vertexArrayBuffer[i * 3 + 2]);
    }
    mesh.vertexArray._trim();
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
            mesh.colorArray._trim();
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
        mesh.normalArray._trim();
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
        mesh.texcoordArray._trim();
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
    if (nodeDesc.mesh !== undefined) {
        node.meshes = meshes[nodeDesc.mesh];
    }
    if (nodeDesc.extras) {
        if (nodeDesc.extras.id) {
            node.id = nodeDesc.extras.id;
        }
        if (nodeDesc.extras.lights) {
            const base64Lights = nodeDesc.extras.lights;
            node.lights = decodeLights(base64Lights);
        }
        if (node.meshes) {
            const anchor: Vec2 = [0, 0];
            for (const mesh of node.meshes) {
                const bounds = mesh.aabb;
                anchor[0] += bounds.min[0] + bounds.max[0];
                anchor[1] += bounds.min[1] + bounds.max[1];
            }
            anchor[0] = Math.floor(anchor[0] / node.meshes.length / 2);
            anchor[1] = Math.floor(anchor[1] / node.meshes.length / 2);
            node.anchor = anchor;
        }
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

type FootprintMesh = {
    vertices: Array<Point>;
    indices: Array<number>;
};

function convertFootprint(mesh: FootprintMesh): ?Footprint {
    if (mesh.vertices.length === 0 || mesh.indices.length === 0) {
        return null;
    }

    const [min, max] = [mesh.vertices[0].clone(), mesh.vertices[0].clone()];

    for (let i = 1; i < mesh.vertices.length; ++i) {
        const v = mesh.vertices[i];
        min.x = Math.min(min.x, v.x);
        min.y = Math.min(min.y, v.y);
        max.x = Math.max(max.x, v.x);
        max.y = Math.max(max.y, v.y);
    }

    // Use a fixed size triangle grid (8x8 cells) for acceleration intersection queries
    // with an exception that the cell size should never be larger than 256 tile units
    // (equals to 32x32 subdivision).
    const optimalCellCount = Math.ceil(Math.max(max.x - min.x, max.y - min.y) / 256);
    const cellCount = Math.max(8, optimalCellCount);
    const grid = new TriangleGridIndex(mesh.vertices, mesh.indices, cellCount);

    return {
        vertices: mesh.vertices,
        indices: mesh.indices,
        grid,
        min,
        max
    };
}

function parseLegacyFootprintMesh(gltfNode: Object): ?FootprintMesh {
    if (!gltfNode.extras || !gltfNode.extras.ground) {
        return null;
    }

    const groundContainer = gltfNode.extras.ground;
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

    if (vertices.length < 3) {
        return null;
    }

    if (vertices.length > 1 && vertices[vertices.length - 1].equals(vertices[0])) {
        vertices.pop();
    }

    // Ensure that the vertex list is defined in CW order
    let cross = 0;

    for (let i = 0; i < vertices.length; i++) {
        const a = vertices[i];
        const b = vertices[(i + 1) % vertices.length];
        const c = vertices[(i + 2) % vertices.length];

        cross += (a.x - b.x) * (c.y - b.y) - (c.x - b.x) * (a.y - b.y);
    }

    if (cross > 0) {
        vertices.reverse();
    }

    // Triangulate the footprint and compute grid acceleration structure for
    // more performant intersection queries.
    const indices = earcut(vertices.flatMap(v => [v.x, v.y]), []);

    if (indices.length === 0) {
        return null;
    }

    return {vertices, indices};
}

function parseNodeFootprintMesh(meshes: Array<Mesh>): ?FootprintMesh {
    const vertices: Array<Point> = [];
    const indices: Array<number> = [];

    let baseVertex = 0;

    for (const mesh of meshes) {
        baseVertex = vertices.length;

        const vArray = mesh.vertexArray.float32;
        const iArray = mesh.indexArray.uint16;

        for (let i = 0; i < mesh.vertexArray.length; i++) {
            vertices.push(new Point(vArray[i * 3 + 0], vArray[i * 3 + 1]));
        }

        for (let i = 0; i < mesh.indexArray.length * 3; i++) {
            indices.push(iArray[i] + baseVertex);
        }
    }

    if (indices.length % 3 !== 0) {
        return null;
    }

    for (let i = 0; i < indices.length; i += 3) {
        const a = vertices[indices[i + 0]];
        const b = vertices[indices[i + 1]];
        const c = vertices[indices[i + 2]];

        if ((a.x - b.x) * (c.y - b.y) - (c.x - b.x) * (a.y - b.y) > 0) {
            // $FlowIssue[unsupported-syntax]
            [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
        }
    }

    return {vertices, indices};
}

function convertFootprints(convertedNodes: Array<Node>, sceneNodes: any, modelNodes: any) {
    // modelNodes == a list of nodes in the gltf file
    // sceneNodes == an index array pointing to modelNodes being parsed
    assert(convertedNodes.length === sceneNodes.length);

    // Two different footprint formats are supported:
    //  1) Legacy format where footprints are defined as a linestring json
    //     inside extras-section of the node.
    //  2) Version "1" where footprints are included as regular gltf meshes and
    //     connected to correct models via matching ids.

    // Find footprint-only nodes from the list.
    const nodeFootprintLookup = {};
    const footprintNodeIndices = new Set();

    for (let i = 0; i < convertedNodes.length; i++) {
        const gltfNode = modelNodes[sceneNodes[i]];

        if (!gltfNode.extras) {
            continue;
        }

        const fpVersion = gltfNode.extras["mapbox:footprint:version"];
        const fpId = gltfNode.extras["mapbox:footprint:id"];

        if (fpVersion || fpId) {
            footprintNodeIndices.add(i);
        }

        if (fpVersion !== "1.0.0" || !fpId) {
            continue;
        }

        nodeFootprintLookup[fpId] = i;
    }

    // Go through nodes and see if either of the supported footprint formats are defined
    for (let i = 0; i < convertedNodes.length; i++) {
        if (footprintNodeIndices.has(i)) {
            continue;
        }

        const node = convertedNodes[i];
        const gltfNode = modelNodes[sceneNodes[i]];

        if (!gltfNode.extras) {
            continue;
        }

        // Prefer footprint nodes over the legacy format
        let fpMesh: ?FootprintMesh = null;

        if (node.id in nodeFootprintLookup) {
            fpMesh = parseNodeFootprintMesh(convertedNodes[nodeFootprintLookup[node.id]].meshes);
        }

        if (!fpMesh) {
            fpMesh = parseLegacyFootprintMesh(gltfNode);
        }

        if (fpMesh) {
            node.footprint = convertFootprint(fpMesh);
        }
    }

    // Remove footprint nodes as they serve no other purpose
    if (footprintNodeIndices.size > 0) {
        const nodesToRemove = Array.from(footprintNodeIndices.values()).sort((a, b) => a - b);

        for (let i = nodesToRemove.length - 1; i >= 0; i--) {
            convertedNodes.splice(nodesToRemove[i], 1);
        }
    }
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
    convertFootprints(nodes, gltfNodes, gltf.json.nodes);
    return nodes;
}

export function convertB3dm(gltf: Object, zScale: number): Array<Node> {
    const nodes = convertModel(gltf);
    for (const node of nodes) {
        if (node.lights) {
            node.meshes.push(createLightsMesh(node.lights, zScale));
            node.lightMeshIndex = node.meshes.length - 1;
        }
    }
    return nodes;
}

function createLightsMesh(lights: Array<AreaLight>, zScale: number): Mesh {

    const mesh: Mesh = {};
    mesh.indexArray = new TriangleIndexArray();
    mesh.indexArray.reserve(4 * lights.length);
    mesh.vertexArray = new ModelLayoutArray();
    mesh.vertexArray.reserve(10 * lights.length);
    mesh.colorArray = new Color4fLayoutArray();
    mesh.vertexArray.reserve(10 * lights.length);

    let currentVertex = 0;
    // Model layer color4 attribute is used for light offset: first three components are light's offset in tile space (z
    // also in tile space) and 4th parameter is a decimal number that carries 2 parts: the distance to full light
    // falloff is in the integer part, and the decimal part represents the ratio of distance where the falloff starts (saturated
    // until it reaches that part).
    for (const light of lights) {
        // fallOff - light range from the door.
        const fallOff = Math.min(10, Math.max(4, 1.3 * light.height)) * zScale;
        const tangent = [-light.normal[1], light.normal[0], 0];
        // 0---3  (at light.height above light.points)
        // |   |
        // 1-p-2  (p for light.position at bottom edge)

        // horizontalSpread is tangent of the angle between light geometry and light normal.
        // Cap it for doors with large inset (depth) to prevent intersecting door posts.
        const horizontalSpread = Math.min(0.29, 0.1 * light.width / light.depth);
        // A simple geometry, that starts at door, starts towards the centre of door to prevent intersecting
        // door posts. Later, additional vertices at depth distance from door could be reconsidered.
        // 0.01f to prevent intersection with door post.
        const width = light.width - 2 * light.depth * zScale * (horizontalSpread + 0.01);
        const v1 = vec3.scaleAndAdd([], light.pos, tangent, width / 2);
        const v2 = vec3.scaleAndAdd([], light.pos, tangent, -width / 2);
        const v0 = [v1[0], v1[1], v1[2] + light.height];
        const v3 = [v2[0], v2[1], v2[2] + light.height];

        const v1extrusion = vec3.scaleAndAdd([], light.normal, tangent, horizontalSpread);
        vec3.scale(v1extrusion, v1extrusion, fallOff);
        const v2extrusion = vec3.scaleAndAdd([], light.normal, tangent, -horizontalSpread);
        vec3.scale(v2extrusion, v2extrusion, fallOff);

        vec3.add(v1extrusion, v1, v1extrusion);
        vec3.add(v2extrusion, v2, v2extrusion);

        v1[2] += 0.1;
        v2[2] += 0.1;
        mesh.vertexArray.emplaceBack(v1extrusion[0], v1extrusion[1], v1extrusion[2]);
        mesh.vertexArray.emplaceBack(v2extrusion[0], v2extrusion[1], v2extrusion[2]);
        mesh.vertexArray.emplaceBack(v1[0], v1[1], v1[2]);
        mesh.vertexArray.emplaceBack(v2[0], v2[1], v2[2]);
        // side: top
        mesh.vertexArray.emplaceBack(v0[0], v0[1], v0[2]);
        mesh.vertexArray.emplaceBack(v3[0], v3[1], v3[2]);
        // side
        mesh.vertexArray.emplaceBack(v1[0], v1[1], v1[2]);
        mesh.vertexArray.emplaceBack(v2[0], v2[1], v2[2]);
        mesh.vertexArray.emplaceBack(v1extrusion[0], v1extrusion[1], v1extrusion[2]);
        mesh.vertexArray.emplaceBack(v2extrusion[0], v2extrusion[1], v2extrusion[2]);
        // Light doesnt include light coordinates - instead it incldues offet to light area segment. Distances are
        // normalized by dividing by fallOff. Normalized lighting coordinate system is used where center of
        // coord system is on half of door and +Y is direction of extrusion.
        // z includes half width - this is used to calculate distance to segment.

        // 2 and 3 are bottom of the door, fully lit.
        const halfWidth = width / fallOff / 2.0;
        // right ground extruded looking out from door
        // x Coordinate is used to model angle (for spot)
        mesh.colorArray.emplaceBack(-halfWidth - horizontalSpread, -1, halfWidth, 0.8);
        mesh.colorArray.emplaceBack(halfWidth + horizontalSpread, -1, halfWidth, 0.8);
        // keep shine at bottom of door even for reduced emissive strength
        mesh.colorArray.emplaceBack(-halfWidth, 0, halfWidth, 1.3);
        mesh.colorArray.emplaceBack(halfWidth, 0, halfWidth, 1.3);
        // for all vertices on the side, push the light origin behind the door top
        mesh.colorArray.emplaceBack(halfWidth + horizontalSpread, -0.8, halfWidth, 0.7);
        mesh.colorArray.emplaceBack(halfWidth + horizontalSpread, -0.8, halfWidth, 0.7);
        // side at door, ground
        mesh.colorArray.emplaceBack(0, 0, halfWidth, 1.3);
        mesh.colorArray.emplaceBack(0, 0, halfWidth, 1.3);
        // extruded side
        mesh.colorArray.emplaceBack(halfWidth + horizontalSpread, -1.2, halfWidth, 0.8);
        mesh.colorArray.emplaceBack(halfWidth + horizontalSpread, -1.2, halfWidth, 0.8);

        // Finally, the triangle indices
        mesh.indexArray.emplaceBack(6 + currentVertex, 4 + currentVertex, 8 + currentVertex);
        mesh.indexArray.emplaceBack(7 + currentVertex, 9 + currentVertex, 5 + currentVertex);
        mesh.indexArray.emplaceBack(0 + currentVertex, 1 + currentVertex, 2 + currentVertex);
        mesh.indexArray.emplaceBack(1 + currentVertex, 3 + currentVertex, 2 + currentVertex);
        currentVertex += 10;
    }
    //mesh.featureArray = new FeatureVertexArray();
    //mesh.featureArray.reserve(10 * lights.length);
    //for (let i = 0; i < 10 * lights.length; i++) {
    //    mesh.featureArray.emplaceBack(0xffff, 0xffff, 0xffff, 0xffff, 0, 0, 0);
    //}
    const material: Material = {};
    material.defined = true;
    material.emissiveFactor = [0, 0, 0];
    const pbrMetallicRoughness = {};
    pbrMetallicRoughness.baseColorFactor = Color.white;
    // $FlowIgnore[prop-missing] don't need all the properties
    material.pbrMetallicRoughness = pbrMetallicRoughness;
    mesh.material = material;
    mesh.aabb = new Aabb([Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]);
    return mesh;
}

function decodeLights(base64: string): Array<AreaLight> {
    if (!base64.length) return [];
    const decoded = base64DecToArr(base64);
    const lights: AreaLight[] = [];
    const lightCount = decoded.length / 24; // 24 bytes (4 uint16 & 4 floats) per light
    // Each door light is defined by two endpoiunts in tile coordinates, left and bottom right
    // (where normal is implied from those two), depth and height.
    // https://github.com/mapbox/mapbox-3dtile-tools/pull/100
    const lightData = new Uint16Array(decoded.buffer);
    const lightDataFloat = new Float32Array(decoded.buffer);
    const stride = 6;
    for (let i = 0; i < lightCount; i++) {
        const h = lightData[i * 2 * stride] / 30;
        const elevation = lightData[i * 2 * stride + 1 ] / 30;
        const bottomLeft = [lightDataFloat[i * stride + 1], lightDataFloat[i * stride + 2], elevation];
        const bottomRight = [lightDataFloat[i * stride + 3], lightDataFloat[i * stride + 4], elevation];
        const normal = vec3.sub([], bottomRight, bottomLeft);
        const length = vec3.length(normal);
        normal[2] = -normal[0];
        normal[0] = normal[1];
        normal[1] = normal[2];
        normal[2] = 0;
        vec3.scale(normal, normal, 1 / length);
        const depth = lightData[i * 2 * stride + 10] / 100;
        const pos = vec3.add([], bottomLeft, bottomRight);
        vec3.scale(pos, pos, 0.5);
        lights.push({pos,
            normal,
            width: length,
            height: h,
            depth,
            points: [ bottomLeft[0], bottomLeft[1], bottomRight[0], bottomRight[1]]
        });
    }
    return lights;
}
