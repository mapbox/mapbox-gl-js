// @flow

import {type Footprint, type Mesh, type Node, type Material, type ModelTexture, type Sampler, type AreaLight, HEIGHTMAP_DIM} from '../data/model.js';
import {Aabb} from '../../src/util/primitives.js';
import Color from '../../src/style-spec/util/color.js';
import {mat4, vec3} from 'gl-matrix';
import {TriangleIndexArray,
    ModelLayoutArray,
    NormalLayoutArray,
    TexcoordLayoutArray,
    Color3fLayoutArray,
    Color4fLayoutArray
} from '../../src/data/array_types.js';
import {GLTF_TO_ARRAY_TYPE, GLTF_COMPONENTS} from '../util/loaders.js';

import Point from '@mapbox/point-geometry';
import earcut from 'earcut';

import {base64DecToArr} from '../../src/util/util.js';
import assert from 'assert';
import TriangleGridIndex from '../../src/util/triangle_grid_index.js';

import type {Class} from '../../src/types/class.js';
import type {Vec2, Vec3, Mat4} from 'gl-matrix';
import type {TextureImage} from '../../src/render/texture.js';

function convertTextures(gltf: Object, images: Array<TextureImage>): Array<ModelTexture> {
    const textures: ModelTexture[] = [];
    const gl = WebGL2RenderingContext;
    if (gltf.json.textures) {
        for (const textureDesc of gltf.json.textures) {
            const sampler: Sampler = {
                magFilter: gl.LINEAR,
                minFilter: gl.NEAREST,
                wrapS: gl.REPEAT,
                wrapT: gl.REPEAT
            };
            if (textureDesc.sampler !== undefined) Object.assign(sampler, gltf.json.samplers[textureDesc.sampler]);
            textures.push({
                image: images[textureDesc.source],
                sampler,
                uploaded: false
            });
        }
    }
    return textures;
}

function convertMaterial(materialDesc: Object, textures: Array<ModelTexture>): Material {
    const {
        emissiveFactor = [0, 0, 0],
        alphaMode = 'OPAQUE',
        alphaCutoff = 0.5,
        normalTexture,
        occlusionTexture,
        emissiveTexture,
        doubleSided
    } = materialDesc;

    const {
        baseColorFactor = [1, 1, 1, 1],
        metallicFactor = 1.0,
        roughnessFactor = 1.0,
        baseColorTexture,
        metallicRoughnessTexture
    } = materialDesc.pbrMetallicRoughness || {};

    const modelOcclusionTexture = occlusionTexture ? textures[occlusionTexture.index] : undefined;
    // Supporting texture transform only for occlusion (mbx landmarks)
    // Check if KHR_Texture_transform is set.
    if (occlusionTexture && occlusionTexture.extensions && occlusionTexture.extensions['KHR_texture_transform'] && modelOcclusionTexture) {
        const transform = occlusionTexture.extensions['KHR_texture_transform'];
        modelOcclusionTexture.offsetScale = [transform.offset[0], transform.offset[1], transform.scale[0], transform.scale[1]];
    }

    return {
        pbrMetallicRoughness: {
            baseColorFactor: new Color(...baseColorFactor),
            metallicFactor,
            roughnessFactor,
            baseColorTexture: baseColorTexture ? textures[baseColorTexture.index] : undefined,
            metallicRoughnessTexture: metallicRoughnessTexture ? textures[metallicRoughnessTexture.index] : undefined
        },
        doubleSided,
        emissiveFactor,
        alphaMode,
        alphaCutoff,
        normalTexture: normalTexture ? textures[normalTexture.index] : undefined,
        occlusionTexture: modelOcclusionTexture,
        emissionTexture: emissiveTexture ? textures[emissiveTexture.index] : undefined,
        defined: materialDesc.defined === undefined // just to make the rendertests the same than native
    };
}

function computeCentroid(indexArray: $TypedArray, vertexArray: $TypedArray): Vec3 {
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

function getNormalizedScale(arrayType: Class<$TypedArray>) {
    switch (arrayType) {
    case Int8Array:
        return 1 / 127;
    case Uint8Array:
        return 1 / 255;
    case Int16Array:
        return 1 / 32767;
    case Uint16Array:
        return 1 / 65535;
    default:
        return 1;
    }
}

function getBufferData(gltf: Object, accessor: Object) {
    const bufferView = gltf.json.bufferViews[accessor.bufferView];
    const buffer = gltf.buffers[bufferView.buffer];
    const offset = (accessor.byteOffset || 0) + (bufferView.byteOffset || 0);
    const ArrayType = GLTF_TO_ARRAY_TYPE[accessor.componentType];
    const itemBytes = GLTF_COMPONENTS[accessor.type] * ArrayType.BYTES_PER_ELEMENT;
    const stride = (bufferView.byteStride && bufferView.byteStride !== itemBytes) ? bufferView.byteStride / ArrayType.BYTES_PER_ELEMENT : GLTF_COMPONENTS[accessor.type];
    const bufferData = new ArrayType(buffer, offset, accessor.count * stride);
    return bufferData;
}

function setArrayData(gltf: Object, accessor: Object, array: Object, buffer: $TypedArray) {
    const ArrayType = GLTF_TO_ARRAY_TYPE[accessor.componentType];
    const norm = getNormalizedScale(ArrayType);
    const bufferView = gltf.json.bufferViews[accessor.bufferView];
    const numElements = bufferView.byteStride ? bufferView.byteStride / ArrayType.BYTES_PER_ELEMENT : GLTF_COMPONENTS[accessor.type];
    const float32Array = (array: any).float32;
    const components = float32Array.length / array.capacity;
    for (let i = 0, count = 0;  i < accessor.count * numElements; i += numElements, count += components) {
        for (let j = 0; j < components; j++) {
            float32Array[count + j] = buffer[i + j] * norm;
        }
    }
    array._trim();
}

function convertPrimitive(primitive: Object, gltf: Object, textures: Array<ModelTexture>): Mesh {
    const indicesIdx = primitive.indices;
    const attributeMap = primitive.attributes;

    const mesh: Mesh = {};

    // eslint-disable-next-line no-warning-comments
    // TODO: Investigate a better way to pass arrays to StructArrays and avoid the double componentType indices
    mesh.indexArray = new TriangleIndexArray();
    // eslint-disable-next-line no-warning-comments
    // TODO: There might be no need to copy element by element to mesh.indexArray.
    const indexAccessor = gltf.json.accessors[indicesIdx];
    const numTriangles = indexAccessor.count / 3;
    mesh.indexArray.reserve(numTriangles);
    const indexArrayBuffer = getBufferData(gltf, indexAccessor);
    for (let i = 0; i < numTriangles; i++) {
        mesh.indexArray.emplaceBack(indexArrayBuffer[i * 3], indexArrayBuffer[i * 3 + 1], indexArrayBuffer[i * 3 + 2]);
    }
    mesh.indexArray._trim();
    // vertices
    mesh.vertexArray = new ModelLayoutArray();

    const positionAccessor = gltf.json.accessors[attributeMap.POSITION];
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
        const colorAccessor = gltf.json.accessors[attributeMap.COLOR_0];
        const numElements = GLTF_COMPONENTS[colorAccessor.type];
        const colorArrayBuffer = getBufferData(gltf, colorAccessor);
        mesh.colorArray = numElements === 3 ? new Color3fLayoutArray() : new Color4fLayoutArray();
        mesh.colorArray.resize(colorAccessor.count);
        setArrayData(gltf, colorAccessor, mesh.colorArray, colorArrayBuffer);
    }

    // normals
    if (attributeMap.NORMAL !== undefined) {
        mesh.normalArray = new NormalLayoutArray();
        const normalAccessor = gltf.json.accessors[attributeMap.NORMAL];
        mesh.normalArray.resize(normalAccessor.count);
        const normalArrayBuffer = getBufferData(gltf, normalAccessor);
        setArrayData(gltf, normalAccessor, mesh.normalArray, normalArrayBuffer);
    }

    // texcoord
    if (attributeMap.TEXCOORD_0 !== undefined && textures.length > 0) {
        mesh.texcoordArray = new TexcoordLayoutArray();
        const texcoordAccessor = gltf.json.accessors[attributeMap.TEXCOORD_0];
        mesh.texcoordArray.resize(texcoordAccessor.count);
        const texcoordArrayBuffer = getBufferData(gltf, texcoordAccessor);
        setArrayData(gltf, texcoordAccessor, mesh.texcoordArray, texcoordArrayBuffer);
    }

    // V2 tiles
    if (attributeMap._FEATURE_ID_RGBA4444 !== undefined) {
        const featureAccesor = gltf.json.accessors[attributeMap._FEATURE_ID_RGBA4444];
        if (gltf.json.extensionsUsed && gltf.json.extensionsUsed.includes('EXT_meshopt_compression')) {
            mesh.featureData = getBufferData(gltf, featureAccesor);
        }
    }

    // V1 tiles
    if (attributeMap._FEATURE_RGBA4444 !== undefined) {
        const featureAccesor = gltf.json.accessors[attributeMap._FEATURE_RGBA4444];
        mesh.featureData = new Uint32Array(getBufferData(gltf, featureAccesor).buffer);
    }

    // Material
    const materialIdx = primitive.material;
    const materialDesc = materialIdx !== undefined ? gltf.json.materials[materialIdx] : {defined: false};
    mesh.material = convertMaterial(materialDesc, textures);

    return mesh;
}

function convertMeshes(gltf: Object, textures: Array<ModelTexture>): Array<Array<Mesh>> {
    const meshes: Mesh[][] = [];
    for (const meshDesc of gltf.json.meshes) {
        const primitives: Mesh[] = [];
        for (const primitive of meshDesc.primitives) {
            primitives.push(convertPrimitive(primitive, gltf, textures));
        }
        meshes.push(primitives);
    }
    return meshes;
}

function convertNode(nodeDesc: Object, gltf: Object, meshes: Array<Array<Mesh>>): Node {
    const {matrix, rotation, translation, scale, mesh, extras, children} = nodeDesc;
    const node: Node = {};
    node.matrix = matrix || mat4.fromRotationTranslationScale([], rotation || [0, 0, 0, 1], translation || [0, 0, 0], scale || [1, 1, 1]);
    if (mesh !== undefined) {
        node.meshes = meshes[mesh];
        const anchor: Vec2 = node.anchor = [0, 0];
        for (const mesh of node.meshes) {
            const {min, max} = mesh.aabb;
            anchor[0] += min[0] + max[0];
            anchor[1] += min[1] + max[1];
        }
        anchor[0] = Math.floor(anchor[0] / node.meshes.length / 2);
        anchor[1] = Math.floor(anchor[1] / node.meshes.length / 2);
    }
    if (extras) {
        if (extras.id) {
            node.id = extras.id;
        }
        if (extras.lights) {
            node.lights = decodeLights(extras.lights);
        }
    }
    if (children) {
        const converted: Node[] = [];
        for (const childNodeIdx of children) {
            converted.push(convertNode(gltf.json.nodes[childNodeIdx], gltf, meshes));
        }
        node.children = converted;
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

    // Use a fixed size triangle grid (8x8 cells) for acceleration intersection queries
    // with an exception that the cell size should never be larger than 256 tile units
    // (equals to 32x32 subdivision).
    const grid = new TriangleGridIndex(mesh.vertices, mesh.indices, 8, 256);
    const [min, max] = [grid.min.clone(), grid.max.clone()];

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

function parseNodeFootprintMesh(meshes: Array<Mesh>, matrix: Mat4): ?FootprintMesh {
    const vertices: Array<Point> = [];
    const indices: Array<number> = [];

    let baseVertex = 0;

    const tempVertex = [];
    for (const mesh of meshes) {
        baseVertex = vertices.length;

        const vArray = mesh.vertexArray.float32;
        const iArray = mesh.indexArray.uint16;

        for (let i = 0; i < mesh.vertexArray.length; i++) {
            tempVertex[0] = vArray[i * 3 + 0];
            tempVertex[1] = vArray[i * 3 + 1];
            tempVertex[2] = vArray[i * 3 + 2];
            vec3.transformMat4(tempVertex, tempVertex, matrix);
            vertices.push(new Point(tempVertex[0], tempVertex[1]));
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
            fpMesh = parseNodeFootprintMesh(convertedNodes[nodeFootprintLookup[node.id]].meshes, node.matrix);
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
    const textures = convertTextures(gltf, gltf.images);
    const meshes = convertMeshes(gltf, textures);

    // select the correct node hierarchy
    const {scenes, scene, nodes} = gltf.json;
    const gltfNodes = scenes ? scenes[scene || 0].nodes : nodes;

    const resultNodes: Node[] = [];
    for (const nodeIdx of gltfNodes) {
        resultNodes.push(convertNode(nodes[nodeIdx], gltf, meshes));
    }
    convertFootprints(resultNodes, gltfNodes, gltf.json.nodes);
    return resultNodes;
}

export function process3DTile(gltf: Object, zScale: number): Array<Node> {
    const nodes = convertModel(gltf);
    for (const node of nodes) {
        for (const mesh of node.meshes) {
            parseHeightmap(mesh);
        }
        if (node.lights) {
            node.lightMeshIndex = node.meshes.length;
            node.meshes.push(createLightsMesh(node.lights, zScale));
        }
    }
    return nodes;
}

function parseHeightmap(mesh: Mesh) {
    // This is a temporary, best effort approach, implementation that's to be removed, for Mapbox landmarks,
    // by a implementation in tiler. It would eventually still be used for 3d party models.
    mesh.heightmap = new Float32Array(HEIGHTMAP_DIM * HEIGHTMAP_DIM);
    mesh.heightmap.fill(-1);

    const vertices = mesh.vertexArray.float32;
    // implementation assumes tile coordinates for x and y and -1 and later +2
    // are to prevent going out of range
    const xMin = mesh.aabb.min[0] - 1;
    const yMin = mesh.aabb.min[1] - 1;
    const xMax = mesh.aabb.max[0];
    const yMax = mesh.aabb.max[1];
    const xRange = xMax - xMin + 2;
    const yRange = yMax - yMin + 2;
    const xCellInv = HEIGHTMAP_DIM / xRange;
    const yCellInv = HEIGHTMAP_DIM / yRange;

    for (let i = 0; i < vertices.length; i += 3) {
        const px = vertices[i + 0];
        const py = vertices[i + 1];
        const pz = vertices[i + 2];
        const x = ((px - xMin) * xCellInv) | 0;
        const y = ((py - yMin) * yCellInv) | 0;
        assert(x >= 0 && x < HEIGHTMAP_DIM);
        assert(y >= 0 && y < HEIGHTMAP_DIM);
        if (pz > mesh.heightmap[y * HEIGHTMAP_DIM + x]) {
            mesh.heightmap[y * HEIGHTMAP_DIM + x] = pz;
        }
    }
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
        // Light doesnt include light coordinates - instead it includes offset to light area segment. Distances are
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
        const height = lightData[i * 2 * stride] / 30;
        const elevation = lightData[i * 2 * stride + 1 ] / 30;
        const depth = lightData[i * 2 * stride + 10] / 100;
        const x0 = lightDataFloat[i * stride + 1];
        const y0 = lightDataFloat[i * stride + 2];
        const x1 = lightDataFloat[i * stride + 3];
        const y1 = lightDataFloat[i * stride + 4];
        const dx = x1 - x0;
        const dy = y1 - y0;
        const width = Math.hypot(dx, dy);
        const normal = [dy / width, -dx / width, 0];
        const pos = [x0 + dx * 0.5, y0 + dy * 0.5, elevation];
        const points = [x0, y0, x1, y1];
        lights.push({pos, normal, width, height, depth, points});
    }
    return lights;
}
