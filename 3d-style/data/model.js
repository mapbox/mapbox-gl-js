// @flow

import LngLat from '../../src/geo/lng_lat.js';
import Color from "../../src/style-spec/util/color.js";
import Texture from '../../src/render/texture.js';
import type IndexBuffer from '../../src/gl/index_buffer.js';
import {ModelLayoutArray, TriangleIndexArray, NormalLayoutArray, TexcoordLayoutArray} from '../../src/data/array_types.js';
import type VertexBuffer from '../../src/gl/vertex_buffer.js';
import type {Mat4} from 'gl-matrix';
import type Context from "../../src/gl/context.js";
import {Aabb} from '../../src/util/primitives.js';
import {mat4} from 'gl-matrix';
import {modelAttributes} from './model_attributes.js';
import SegmentVector from '../../src/data/segment.js';

export type PbrMetallicRoughness = {
    baseColor?: Color;
    metallicFactor?: 0.0;
    roughnessFactor?: 1.0;
    baseColorTexture?: Texture;
    metallicRoughnessTexture?: Texture;
}

export type Material = {
    normalTexture?: Texture;
    occlusionTexture?: Texture;
    emissionTexture?: Texture;
    pbrMetallicRoughness: PbrMetallicRoughness;
    emissiveFactor?: [number, number, number];
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
    material: Material;
    aabb: Aabb;
    segments: SegmentVector;
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
        this.position = new LngLat(position[1], position[0]);
        this.orientation = orientation;
        this.nodes = nodes;
        this.uploaded = false;
        this.aabb = new Aabb([Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]);
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

    _upload(node: Node, context: Context) {
        if (node.meshes) {
            for (const mesh of node.meshes) {
                mesh.indexBuffer = context.createIndexBuffer(mesh.indexArray);
                mesh.vertexBuffer = context.createVertexBuffer(mesh.vertexArray, modelAttributes.members);
                mesh.segments = SegmentVector.simpleSegment(0, 0, mesh.vertexArray.length, mesh.indexArray.length);
            }
        }
        if (node.children) {
            for (const child of node.children) {
                this._upload(child, context);
            }
        }
    }

    upload(context: Context) {
        if (this.uploaded) return;
        for (const node of this.nodes) {
            this._upload(node, context);
        }
        this.uploaded = true;
    }

    destroy() {

    }
}
