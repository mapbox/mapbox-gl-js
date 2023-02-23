// @flow

import type Painter from '../../src/render/painter.js';
import type SourceCache from '../../src/source/source_cache.js';
import type ModelStyleLayer from '../style/style_layer/model_style_layer.js';

import {modelUniformValues} from './program/model_program.js';
import type {Mesh, Node} from '../data/model.js';

import StencilMode from '../../src/gl/stencil_mode.js';
import DepthMode from '../../src/gl/depth_mode.js';
import CullFaceMode from '../../src/gl/cull_face_mode.js';
import {mat4} from 'gl-matrix';
import type {Mat4} from 'gl-matrix';

export default drawModels;

function drawMesh(mesh: Mesh, painter: Painter, layer: ModelStyleLayer, worldViewProjection: Mat4) {

    const context = painter.context;

    const uniformValues = modelUniformValues(new Float32Array(worldViewProjection));

    const stencilMode = StencilMode.disabled;
    const depthMode = new DepthMode(painter.context.gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D);
    const colorMode = painter.colorModeForRenderPass();

    const program = painter.useProgram('model');
    program.draw(context, context.gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.disabled,
            uniformValues, layer.id, mesh.vertexBuffer, mesh.indexBuffer, mesh.segments);
}

function drawNode(node: Node, painter: Painter, layer: ModelStyleLayer, modelMatrix: Mat4) {

    const nodeModelMatrix = mat4.multiply([], modelMatrix, node.matrix);
    const worldViewProjection = mat4.multiply(nodeModelMatrix, painter.transform.projMatrix, nodeModelMatrix);
    if (node.meshes) {
        for (const mesh of node.meshes) {
            drawMesh(mesh, painter, layer, worldViewProjection);
        }
    }
    if (node.children) {
        for (const child of node.children) {
            drawNode(child, painter, layer, modelMatrix);
        }
    }
}

export function upload(painter: Painter, sourceCache: SourceCache) {
    const modelSource = sourceCache.getSource();
    if (!modelSource.loaded()) return;
    const models = (modelSource: any).getModels();

    // Upload models
    for (const model of models) {
        model.upload(painter.context);
    }
}

function drawModels(painter: Painter, sourceCache: SourceCache, layer: ModelStyleLayer) {
    if (painter.renderPass !== 'translucent') return;
    const modelSource = sourceCache.getSource();

    if (!modelSource.loaded()) return;
    const models = (modelSource: any).getModels();

    // Draw models
    for (const model of models) {
        for (const node of model.nodes) {
            drawNode(node, painter, layer, model.matrix);
        }
    }
}

