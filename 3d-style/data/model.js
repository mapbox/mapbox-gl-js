// @flow

import type Painter from '../../src/render/painter.js';
import LngLat from '../../src/geo/lng_lat.js';
import Color from "../../src/style-spec/util/color.js";
import Texture from '../../src/render/texture.js';
import type IndexBuffer from '../../src/gl/index_buffer.js';
import {ModelLayoutArray, TriangleIndexArray, NormalLayoutArray, TexcoordLayoutArray} from '../../src/data/array_types.js';
import {StructArray} from '../../src/util/struct_array.js';
import type VertexBuffer from '../../src/gl/vertex_buffer.js';
import type {Mat4, Vec3} from 'gl-matrix';
import type Context from "../../src/gl/context.js";
import {Aabb} from '../../src/util/primitives.js';
import {mat4} from 'gl-matrix';
import {modelAttributes, normalAttributes, texcoordAttributes, color3fAttributes, color4fAttributes} from './model_attributes.js';
import type {TextureImage, TextureWrap, TextureFilter} from '../../src/render/texture.js';
import SegmentVector from '../../src/data/segment.js';
import Projection from '../../src/geo/projection/projection.js';
import {degToRad} from '../../src/util/util.js';

export type Sampler = {
    minFilter: TextureFilter;
    magFilter: TextureFilter;
    wrapS: TextureWrap;
    wrapT: TextureWrap;
    mipmaps: boolean
}

export type ModelTexture = {
    image: TextureImage;
    sampler: Sampler;
    gfxTexture?: Texture;
    uploaded: boolean;
}

export type PbrMetallicRoughness = {
    baseColorFactor: Color;
    metallicFactor: number;
    roughnessFactor: number;
    baseColorTexture: ModelTexture;
    metallicRoughnessTexture: ModelTexture;
}

export type Material = {
    normalTexture: ModelTexture;
    occlusionTexture: ModelTexture;
    emissionTexture: ModelTexture;
    pbrMetallicRoughness: PbrMetallicRoughness;
    emissiveFactor: [number, number, number];
    alphaMode: string;
    alphaCutoff: number;
    defined: boolean;
}

export type Mesh = {
    // eslint-disable-next-line no-warning-comments
    indexArray: TriangleIndexArray; // TODO: Add TriangleStrip, etc
    indexBuffer: IndexBuffer;
    vertexArray: ModelLayoutArray;
    vertexBuffer: VertexBuffer;
    normalArray: NormalLayoutArray;
    normalBuffer: VertexBuffer;
    texcoordArray: TexcoordLayoutArray;
    texcoordBuffer: VertexBuffer;
    colorArray: StructArray;
    colorBuffer: VertexBuffer;
    material: Material;
    aabb: Aabb;
    segments: SegmentVector;
    centroid: Vec3;
}

export type Node = {
    id: string;
    matrix: Mat4;
    meshes: Array<Mesh>;
    children: Array<Node>;
}

export default class Model {
    id: string;
    uri: string;
    position: LngLat;
    orientation: [number, number, number];
    nodes: Array<Node>;
    matrix: Mat4;
    uploaded: boolean;
    aabb: Aabb;

    constructor(id: string, uri: string, position: [number, number], orientation: [number, number, number], nodes: Array<Node>) {
        this.id = id;
        this.uri = uri;
        this.position = position !== undefined ? new LngLat(position[1], position[0]) : new LngLat(0, 0);

        this.orientation = orientation !== undefined ? orientation : [0, 0, 0];
        this.nodes = nodes;
        this.uploaded = false;
        this.aabb = new Aabb([Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]);
        this.matrix = [];
    }

    _applyTransformations(node: Node, parentMatrix: Mat4) {
        // update local matrix
        mat4.multiply(node.matrix, parentMatrix, node.matrix);
        // apply local transform to bounding volume
        if (node.meshes) {
            for (const mesh of node.meshes) {
                const enclosingBounds = Aabb.applyTransform(mesh.aabb, node.matrix);
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
        const localMatrix =  mat4.identity([]);
        for (const node of this.nodes) {
            this._applyTransformations(node, localMatrix);
        }
    }

    _rotationScaleYZFlipMatrix(out: Mat4, rotation: Vec3, scale: Vec3) {
        mat4.identity(out);
        mat4.rotateZ(out, out, degToRad(rotation[2]));
        mat4.rotateX(out, out, degToRad(rotation[0]));
        mat4.rotateY(out, out, degToRad(rotation[1]));

        mat4.scale(out, out, scale);

        // gltf spec uses right handed coordinate space where +y is up. Coordinate space transformation matrix
        // has to be created for the initial transform to our left handed coordinate space
        const coordSpaceTransform = [
            1, 0, 0, 0,
            0, 0, 1, 0,
            0, 1, 0, 0,
            0, 0, 0, 1
        ];

        mat4.multiply(out, out, coordSpaceTransform);
    }

    computeModelMatrix(painter: Painter, rotation: Vec3, scale: Vec3, translation: Vec3) {
        const state = painter.transform;
        const zoom = state.zoom;
        const projectedPoint = state.project(this.position);
        const modelMetersPerPixel = Projection.getMetersPerPixelAtLatitude(this.position.lat, zoom);
        const modelPixelsPerMeter = 1.0 / modelMetersPerPixel;
        mat4.identity(this.matrix);
        const offset = [projectedPoint.x + translation[0] * modelPixelsPerMeter, projectedPoint.y + translation[1] * modelPixelsPerMeter, translation[2]];
        mat4.translate(this.matrix, this.matrix, offset);
        const scaleXY = [modelPixelsPerMeter, modelPixelsPerMeter, 1.0];
        mat4.scale(this.matrix, this.matrix, scaleXY);

        // When applying physics (rotation) we need to insert rotation matrix
        // between model rotation and transforms above. Keep the intermediate results.
        const modelMatrixBeforeRotationScaleYZFlip = this.matrix;

        const orientation = this.orientation;

        const rotationScaleYZFlip: Mat4 = [];
        this._rotationScaleYZFlipMatrix(rotationScaleYZFlip,
                              [orientation[0] + rotation[0],
                                  orientation[1] + rotation[1],
                                  orientation[2] + rotation[2]],
                               scale);
        mat4.multiply(this.matrix, modelMatrixBeforeRotationScaleYZFlip, rotationScaleYZFlip);
    }

    _uploadTexture(texture: ModelTexture, context: Context,) {
        if (!texture.uploaded) {
            texture.gfxTexture = new Texture(context, texture.image, context.gl.RGBA, {useMipmap: texture.sampler.mipmaps});
            texture.uploaded = true;
            texture.image = (null: any);
        }
    }

    _uploadMesh(mesh: Mesh, context: Context) {
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
        mesh.segments = SegmentVector.simpleSegment(0, 0, mesh.vertexArray.length, mesh.indexArray.length);

        // Textures
        const material = mesh.material;
        if (material.pbrMetallicRoughness.baseColorTexture) {
            this._uploadTexture(material.pbrMetallicRoughness.baseColorTexture, context);
        }
        if (material.pbrMetallicRoughness.metallicRoughnessTexture) {
            this._uploadTexture(material.pbrMetallicRoughness.metallicRoughnessTexture, context);
        }
        if (material.normalTexture) {
            this._uploadTexture(material.normalTexture, context);
        }
        if (material.occlusionTexture) {
            this._uploadTexture(material.occlusionTexture, context);
        }
        if (material.emissionTexture) {
            this._uploadTexture(material.emissionTexture, context);
        }
    }

    _uploadNode(node: Node, context: Context) {
        if (node.meshes) {
            for (const mesh of node.meshes) {
                this._uploadMesh(mesh, context);
            }
        }
        if (node.children) {
            for (const child of node.children) {
                this._uploadNode(child, context);
            }
        }
    }

    _destroyNodeArrays(node: Node) {
        if (node.meshes) {
            for (const mesh of node.meshes) {
                mesh.indexArray.destroy();
                mesh.vertexArray.destroy();
                if (mesh.colorArray) mesh.colorArray.destroy();
                if (mesh.normalArray) mesh.normalArray.destroy();
                if (mesh.texcoordArray) mesh.texcoordArray.destroy();
            }
        }
        if (node.children) {
            for (const child of node.children) {
                this._destroyNodeArrays(child);
            }
        }
    }

    upload(context: Context) {
        if (this.uploaded) return;
        for (const node of this.nodes) {
            this._uploadNode(node, context);
        }

        // Now destroy all buffers
        for (const node of this.nodes) {
            this._destroyNodeArrays(node);
        }

        this.uploaded = true;
    }

    _destroyTextures(material: Material) {
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

    _destroyBuffers(node: Node) {
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
                mesh.segments.destroy();
                if (mesh.material) {
                    this._destroyTextures(mesh.material);
                }
            }
        }
        if (node.children) {
            for (const child of node.children) {
                this._destroyBuffers(child);
            }
        }
    }

    destroy() {
        for (const node of this.nodes) {
            this._destroyBuffers(node);
        }
    }
}
