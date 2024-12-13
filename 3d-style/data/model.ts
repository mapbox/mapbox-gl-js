import LngLat from '../../src/geo/lng_lat';
import Texture from '../../src/render/texture';
import {Aabb} from '../../src/util/primitives';
import {mat4, vec4} from 'gl-matrix';
import {modelAttributes, normalAttributes, texcoordAttributes, color3fAttributes, color4fAttributes, featureAttributes} from './model_attributes';
import SegmentVector from '../../src/data/segment';
import {globeToMercatorTransition} from '../../src/geo/projection/globe_util';
import {number as interpolate} from '../../src/style-spec/util/interpolate';
import MercatorCoordinate, {getMetersPerPixelAtLatitude, getLatitudeScale, mercatorZfromAltitude} from '../../src/geo/mercator_coordinate';
import {rotationScaleYZFlipMatrix, getBoxBottomFace, rotationFor3Points, convertModelMatrixForGlobe} from '../util/model_util';

import type {StructArray} from '../../src/util/struct_array';
import type {ModelLayoutArray, TriangleIndexArray, NormalLayoutArray, TexcoordLayoutArray, FeatureVertexArray} from '../../src/data/array_types';
import type Color from '../../src/style-spec/util/color';
import type {vec2, vec3, quat} from 'gl-matrix';
import type Context from '../../src/gl/context';
import type IndexBuffer from '../../src/gl/index_buffer';
import type Painter from '../../src/render/painter';
import type VertexBuffer from '../../src/gl/vertex_buffer';
import type {TextureImage, TextureWrap, TextureFilter} from '../../src/render/texture';
import type Transform from '../../src/geo/transform';
import type {Footprint} from '../util/conflation';

export type Sampler = {
    minFilter: TextureFilter;
    magFilter: TextureFilter;
    wrapS: TextureWrap;
    wrapT: TextureWrap;
};

export type ModelTexture = {
    image: TextureImage;
    sampler: Sampler;
    gfxTexture?: Texture;
    uploaded: boolean;
    offsetScale?: [number, number, number, number];
};

export type PbrMetallicRoughness = {
    baseColorFactor: Color;
    metallicFactor: number;
    roughnessFactor: number;
    baseColorTexture: ModelTexture | null | undefined;
    metallicRoughnessTexture: ModelTexture | null | undefined;
};

export type Material = {
    normalTexture: ModelTexture | null | undefined;
    occlusionTexture: ModelTexture | null | undefined;
    emissionTexture: ModelTexture | null | undefined;
    pbrMetallicRoughness: PbrMetallicRoughness;
    emissiveFactor: [number, number, number];
    alphaMode: string;
    alphaCutoff: number;
    doubleSided: boolean;
    defined: boolean;
};

export const HEIGHTMAP_DIM = 64;

export type Mesh = {
    // eslint-disable-next-line no-warning-comments
    indexArray: TriangleIndexArray // TODO: Add TriangleStrip, etc;
    indexBuffer: IndexBuffer;
    vertexArray: ModelLayoutArray;
    vertexBuffer: VertexBuffer;
    normalArray: NormalLayoutArray;
    normalBuffer: VertexBuffer;
    texcoordArray: TexcoordLayoutArray;
    texcoordBuffer: VertexBuffer;
    colorArray: StructArray;
    colorBuffer: VertexBuffer;
    featureData: ArrayBufferView;
    featureArray: FeatureVertexArray;
    pbrBuffer: VertexBuffer;
    material: Material;
    aabb: Aabb;
    transformedAabb: Aabb;
    segments: SegmentVector;
    centroid: vec3;
    heightmap: Float32Array;
};

// A rectangle with 5 DoF, no rolling
export type AreaLight = {
    pos: vec3;
    normal: vec3;
    width: number;
    height: number;
    depth: number;
    points: vec4;
};

export type ModelNode = {
    id: string;
    matrix: mat4;
    meshes: Array<Mesh>;
    children: Array<ModelNode>;
    footprint: Footprint | null | undefined;
    lights: Array<AreaLight>;
    lightMeshIndex: number;
    elevation: number | null | undefined;
    anchor: vec2;
    hidden: boolean;
};

export const ModelTraits = {
    CoordinateSpaceTile : 1,
    CoordinateSpaceYUp : 2, // not used yet.
    HasMapboxMeshFeatures : 1 << 2,
    HasMeshoptCompression: 1 << 3
} as const;

export const DefaultModelScale = [1, 1, 1] as const;

function positionModelOnTerrain(
    rotationOnTerrain: quat,
    transform: Transform,
    aabb: Aabb,
    matrix: mat4,
    position: LngLat,
): number {
    const elevation = transform.elevation;
    if (!elevation) {
        return 0.0;
    }
    const corners = Aabb.projectAabbCorners(aabb, matrix);
    const meterToMercator = mercatorZfromAltitude(1, position.lat) * transform.worldSize;
    const bottomFace = getBoxBottomFace(corners, meterToMercator);

    const b0 = corners[bottomFace[0]];
    const b1 = corners[bottomFace[1]];
    const b2 = corners[bottomFace[2]];
    const b3 = corners[bottomFace[3]];

    const e0 = elevation.getAtPointOrZero(new MercatorCoordinate(b0[0] / transform.worldSize, b0[1] / transform.worldSize), 0);
    const e1 = elevation.getAtPointOrZero(new MercatorCoordinate(b1[0] / transform.worldSize, b1[1] / transform.worldSize), 0);
    const e2 = elevation.getAtPointOrZero(new MercatorCoordinate(b2[0] / transform.worldSize, b2[1] / transform.worldSize), 0);
    const e3 = elevation.getAtPointOrZero(new MercatorCoordinate(b3[0] / transform.worldSize, b3[1] / transform.worldSize), 0);

    const d03 = (e0 + e3) / 2;
    const d12 = (e1 + e2) / 2;

    if (d03 > d12) {
        if (e1 < e2) {
            rotationFor3Points(rotationOnTerrain, b1, b3, b0, e1, e3, e0, meterToMercator);
        } else {
            rotationFor3Points(rotationOnTerrain, b2, b0, b3, e2, e0, e3, meterToMercator);
        }
    } else {
        if (e0 < e3) {
            rotationFor3Points(rotationOnTerrain, b0, b1, b2, e0, e1, e2, meterToMercator);
        } else {
            rotationFor3Points(rotationOnTerrain, b3, b2, b1, e3, e2, e1, meterToMercator);
        }
    }
    return Math.max(d03, d12);
}

export function calculateModelMatrix(matrix: mat4, model: Readonly<Model>, state: Transform, position: LngLat, rotation: vec3, scale: vec3, translation: vec3, applyElevation: boolean, followTerrainSlope: boolean, viewportScale: boolean = false) {
    const zoom = state.zoom;
    const projectedPoint = state.project(position);
    const modelMetersPerPixel = getMetersPerPixelAtLatitude(position.lat, zoom);
    const modelPixelsPerMeter = 1.0 / modelMetersPerPixel;
    mat4.identity(matrix);
    const offset = [projectedPoint.x + translation[0] * modelPixelsPerMeter, projectedPoint.y + translation[1] * modelPixelsPerMeter, translation[2]];
    mat4.translate(matrix, matrix, offset as [number, number, number]);
    let scaleXY = 1.0;
    let scaleZ = 1.0;
    const worldSize = state.worldSize;
    if (viewportScale) {
        if (state.projection.name === 'mercator') {
            let elevation = 0.0;
            if (state.elevation) {
                elevation = state.elevation.getAtPointOrZero(new MercatorCoordinate(projectedPoint.x / worldSize, projectedPoint.y / worldSize), 0.0);
            }
            const mercProjPos = vec4.transformMat4([] as any, [projectedPoint.x, projectedPoint.y, elevation, 1.0], state.projMatrix);
            const mercProjectionScale = mercProjPos[3] / state.cameraToCenterDistance;
            const viewMetersPerPixel = getMetersPerPixelAtLatitude(state.center.lat, zoom);
            scaleXY = mercProjectionScale;
            scaleZ = mercProjectionScale * viewMetersPerPixel;
        } else if (state.projection.name === 'globe') {
            const globeMatrix = convertModelMatrixForGlobe(matrix, state);
            const worldViewProjection = mat4.multiply([] as any, state.projMatrix, globeMatrix);
            const globeProjPos =  [0, 0, 0, 1];
            vec4.transformMat4(globeProjPos as [number, number, number, number], globeProjPos as [number, number, number, number], worldViewProjection);
            const globeProjectionScale = globeProjPos[3] / state.cameraToCenterDistance;
            const transition = globeToMercatorTransition(zoom);
            const modelPixelConv = state.projection.pixelsPerMeter(position.lat, worldSize) * getMetersPerPixelAtLatitude(position.lat, zoom);
            const viewPixelConv = state.projection.pixelsPerMeter(state.center.lat, worldSize) * getMetersPerPixelAtLatitude(state.center.lat, zoom);
            const viewLatScale = getLatitudeScale(state.center.lat);
            // Compensate XY size difference from model latitude, taking into account globe-mercator transition
            scaleXY = globeProjectionScale / interpolate(modelPixelConv, viewLatScale, transition);
            // Compensate height difference from model latitude.
            // No interpolation, because the Z axis is fixed in globe projection.
            scaleZ = globeProjectionScale * modelMetersPerPixel / modelPixelConv;
            // In globe projection, zoom and scale do not match anymore.
            // Use pixelScaleConversion to scale to correct worldSize.
            scaleXY *= viewPixelConv;
            scaleZ *= viewPixelConv;
        }
    } else {
        scaleXY = modelPixelsPerMeter;
    }

    mat4.scale(matrix, matrix, [scaleXY, scaleXY, scaleZ]);

    // When applying physics (rotation) we need to insert rotation matrix
    // between model rotation and transforms above. Keep the intermediate results.
    const modelMatrixBeforeRotationScaleYZFlip = [...matrix] as mat4;

    const orientation = model.orientation;

    const rotationScaleYZFlip = [] as unknown as mat4;
    rotationScaleYZFlipMatrix(
        rotationScaleYZFlip,
        [
            orientation[0] + rotation[0],
            orientation[1] + rotation[1],
            orientation[2] + rotation[2]
        ],
        scale
    );
    mat4.multiply(matrix, modelMatrixBeforeRotationScaleYZFlip, rotationScaleYZFlip);

    if (applyElevation && state.elevation) {
        let elevate = 0;
        const rotateOnTerrain = [] as unknown as quat;
        if (followTerrainSlope && state.elevation) {
            elevate = positionModelOnTerrain(rotateOnTerrain, state, model.aabb, matrix, position);
            const rotationOnTerrain = mat4.fromQuat([] as unknown as mat4, rotateOnTerrain);
            const appendRotation = mat4.multiply([] as any, rotationOnTerrain, rotationScaleYZFlip);
            mat4.multiply(matrix, modelMatrixBeforeRotationScaleYZFlip, appendRotation);
        } else {
            elevate = state.elevation.getAtPointOrZero(new MercatorCoordinate(projectedPoint.x / worldSize, projectedPoint.y / worldSize), 0.0);
        }
        if (elevate !== 0) {
            matrix[14] += elevate;
        }
    }
}

export default class Model {
    id: string;
    position: LngLat;
    orientation: [number, number, number];
    nodes: Array<ModelNode>;
    matrix: mat4;
    uploaded: boolean;
    aabb: Aabb;

    constructor(id: string, position: [number, number] | null | undefined, orientation: [number, number, number] | null | undefined, nodes: Array<ModelNode>) {
        this.id = id;
        this.position = position != null ? new LngLat(position[0], position[1]) : new LngLat(0, 0);

        this.orientation = orientation != null ? orientation : [0, 0, 0];
        this.nodes = nodes;
        this.uploaded = false;
        this.aabb = new Aabb([Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]);
        this.matrix = [] as unknown as mat4;
    }

    _applyTransformations(node: ModelNode, parentMatrix: mat4) {
        // update local matrix
        mat4.multiply(node.matrix, parentMatrix, node.matrix);
        // apply local transform to bounding volume
        if (node.meshes) {
            for (const mesh of node.meshes) {
                const enclosingBounds = Aabb.applyTransformFast(mesh.aabb, node.matrix);
                this.aabb.encapsulate(enclosingBounds);
            }
        }
        if (node.children) {
            for (const child of node.children) {
                this._applyTransformations(child, node.matrix);
            }
        }
    }

    computeBoundsAndApplyParent() {
        const localMatrix =  mat4.identity([] as any);
        for (const node of this.nodes) {
            this._applyTransformations(node, localMatrix);
        }
    }

    computeModelMatrix(painter: Painter, rotation: vec3, scale: vec3, translation: vec3, applyElevation: boolean, followTerrainSlope: boolean, viewportScale: boolean = false) {
        // calculate the model matrix for the single instance that uses the model.
        calculateModelMatrix(this.matrix, this, painter.transform, this.position, rotation, scale, translation, applyElevation, followTerrainSlope, viewportScale);
    }

    upload(context: Context) {
        if (this.uploaded) return;
        for (const node of this.nodes) {
            uploadNode(node, context);
        }

        // Now destroy all buffers
        for (const node of this.nodes) {
            destroyNodeArrays(node);
        }

        this.uploaded = true;
    }

    destroy() {
        for (const node of this.nodes) {
            destroyBuffers(node);
        }
    }
}

export function uploadTexture(texture: ModelTexture, context: Context, useSingleChannelTexture: boolean = false) {
    const textureFormat = useSingleChannelTexture ? context.gl.R8 : context.gl.RGBA8;
    if (!texture.uploaded) {
        const useMipmap = texture.sampler.minFilter >= context.gl.NEAREST_MIPMAP_NEAREST;
        texture.gfxTexture = new Texture(context, texture.image, textureFormat, {useMipmap});
        texture.uploaded = true;
        texture.image = (null as any);
    }
}

export function uploadMesh(mesh: Mesh, context: Context, useSingleChannelOcclusionTexture?: boolean) {
    // Buffers
    // Note: array buffers could reused for different nodes so destroy them in a later pass
    mesh.indexBuffer = context.createIndexBuffer(mesh.indexArray, false, true);
    mesh.vertexBuffer = context.createVertexBuffer(mesh.vertexArray, modelAttributes.members, false, true);
    if (mesh.normalArray) {
        mesh.normalBuffer = context.createVertexBuffer(mesh.normalArray, normalAttributes.members, false, true);
    }
    if (mesh.texcoordArray) {
        mesh.texcoordBuffer = context.createVertexBuffer(mesh.texcoordArray, texcoordAttributes.members, false, true);
    }
    if (mesh.colorArray) {
        const colorAttributes = mesh.colorArray.bytesPerElement === 12 ? color3fAttributes : color4fAttributes;
        mesh.colorBuffer = context.createVertexBuffer(mesh.colorArray, colorAttributes.members, false, true);
    }
    if (mesh.featureArray) {
        mesh.pbrBuffer = context.createVertexBuffer(mesh.featureArray, featureAttributes.members, true);
    }
    mesh.segments = SegmentVector.simpleSegment(0, 0, mesh.vertexArray.length, mesh.indexArray.length);

    // Textures
    const material = mesh.material;
    if (material.pbrMetallicRoughness.baseColorTexture) {
        uploadTexture(material.pbrMetallicRoughness.baseColorTexture, context);
    }
    if (material.pbrMetallicRoughness.metallicRoughnessTexture) {
        uploadTexture(material.pbrMetallicRoughness.metallicRoughnessTexture, context);
    }
    if (material.normalTexture) {
        uploadTexture(material.normalTexture, context);
    }
    if (material.occlusionTexture) {
        uploadTexture(material.occlusionTexture, context, useSingleChannelOcclusionTexture);
    }
    if (material.emissionTexture) {
        uploadTexture(material.emissionTexture, context);
    }
}

export function uploadNode(node: ModelNode, context: Context, useSingleChannelOcclusionTexture?: boolean) {
    if (node.meshes) {
        for (const mesh of node.meshes) {
            uploadMesh(mesh, context, useSingleChannelOcclusionTexture);
        }
    }
    if (node.children) {
        for (const child of node.children) {
            uploadNode(child, context, useSingleChannelOcclusionTexture);
        }
    }
}

export function destroyNodeArrays(node: ModelNode) {
    if (node.meshes) {
        for (const mesh of node.meshes) {
            mesh.indexArray.destroy();
            mesh.vertexArray.destroy();
            if (mesh.colorArray) mesh.colorArray.destroy();
            if (mesh.normalArray) mesh.normalArray.destroy();
            if (mesh.texcoordArray) mesh.texcoordArray.destroy();
            if (mesh.featureArray) {
                mesh.featureArray.destroy();
            }
        }
    }
    if (node.children) {
        for (const child of node.children) {
            destroyNodeArrays(child);
        }
    }
}

export function destroyTextures(material: Material) {
    if (material.pbrMetallicRoughness.baseColorTexture && material.pbrMetallicRoughness.baseColorTexture.gfxTexture) {
        material.pbrMetallicRoughness.baseColorTexture.gfxTexture.destroy();
    }
    if (material.pbrMetallicRoughness.metallicRoughnessTexture && material.pbrMetallicRoughness.metallicRoughnessTexture.gfxTexture) {
        material.pbrMetallicRoughness.metallicRoughnessTexture.gfxTexture.destroy();
    }
    if (material.normalTexture && material.normalTexture.gfxTexture) {
        material.normalTexture.gfxTexture.destroy();
    }
    if (material.emissionTexture && material.emissionTexture.gfxTexture) {
        material.emissionTexture.gfxTexture.destroy();
    }
    if (material.occlusionTexture && material.occlusionTexture.gfxTexture) {
        material.occlusionTexture.gfxTexture.destroy();
    }
}

export function destroyBuffers(node: ModelNode) {
    if (node.meshes) {
        for (const mesh of node.meshes) {
            if (!mesh.vertexBuffer) continue;
            mesh.vertexBuffer.destroy();
            mesh.indexBuffer.destroy();
            if (mesh.normalBuffer) {
                mesh.normalBuffer.destroy();
            }
            if (mesh.texcoordBuffer) {
                mesh.texcoordBuffer.destroy();
            }
            if (mesh.colorBuffer) {
                mesh.colorBuffer.destroy();
            }
            if (mesh.pbrBuffer) {
                mesh.pbrBuffer.destroy();
            }

            mesh.segments.destroy();
            if (mesh.material) {
                destroyTextures(mesh.material);
            }
        }
    }
    if (node.children) {
        for (const child of node.children) {
            destroyBuffers(child);
        }
    }
}
