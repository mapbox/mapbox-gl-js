// @flow

import type Painter from '../../src/render/painter.js';
import type SourceCache from '../../src/source/source_cache.js';
import type ModelStyleLayer from '../style/style_layer/model_style_layer.js';

import {modelUniformValues} from './program/model_program.js';
import type {Mesh, Node} from '../data/model.js';
import type {DynamicDefinesType} from '../../src/render/program/program_uniforms.js';

import Transform from '../../src/geo/transform.js';
import StencilMode from '../../src/gl/stencil_mode.js';
import ColorMode from '../../src/gl/color_mode.js';
import DepthMode from '../../src/gl/depth_mode.js';
import CullFaceMode from '../../src/gl/cull_face_mode.js';
import {mat4, vec3} from 'gl-matrix';
import type {Mat4} from 'gl-matrix';
import MercatorCoordinate, {getMetersPerPixelAtLatitude} from '../../src/geo/mercator_coordinate.js';
import TextureSlots from './texture_slots.js';
import {convertModelMatrixForGlobe} from '../util/model_util.js';

export default drawModels;

type ModelParameters = {
    zScaleMatrix: Mat4;
    negCameraPosMatrix: Mat4;
}

type SortedMesh = {
    mesh: Mesh;
    depth: number;
    modelIndex: number;
    worldViewProjection: Mat4;
    nodeModelMatrix: Mat4;
}

function fogMatrixForModel(modelMatrix: Mat4, transform: Transform): Mat4 {
    // convert model matrix from the default world size to the one used by the fog
    const fogMatrix = [...modelMatrix];
    const scale = transform.cameraWorldSizeForFog / transform.worldSize;
    const scaleMatrix = mat4.identity([]);
    mat4.scale(scaleMatrix, scaleMatrix, [scale, scale, 1]);
    mat4.multiply(fogMatrix, scaleMatrix, fogMatrix);
    mat4.multiply(fogMatrix, transform.worldToFogMatrix, fogMatrix);
    return fogMatrix;
}

function drawMesh(sortedMesh: SortedMesh, painter: Painter, layer: ModelStyleLayer, modelParameters: ModelParameters, stencilMode, colorMode) {

    // early return if totally transparent
    const opacity = layer.paint.get('model-opacity');
    if (opacity === 0) {
        return;
    }

    const context = painter.context;
    const depthMode = new DepthMode(painter.context.gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D);

    const definesValues = [];

    const mesh = sortedMesh.mesh;
    const material = mesh.material;
    const pbr = material.pbrMetallicRoughness;

    let lightingMatrix;
    if (painter.transform.projection.zAxisUnit === "pixels") {
        lightingMatrix = [...sortedMesh.nodeModelMatrix];
    } else {
        lightingMatrix = mat4.multiply([], modelParameters.zScaleMatrix, sortedMesh.nodeModelMatrix);
    }
    mat4.multiply(lightingMatrix, modelParameters.negCameraPosMatrix, lightingMatrix);
    const normalMatrix = mat4.invert([], lightingMatrix);
    mat4.transpose(normalMatrix, normalMatrix);

    const uniformValues = modelUniformValues(
        new Float32Array(sortedMesh.worldViewProjection),
        new Float32Array(lightingMatrix),
        new Float32Array(normalMatrix),
        painter,
        opacity,
        pbr.baseColorFactor,
        material.emissiveFactor,
        pbr.metallicFactor,
        pbr.roughnessFactor,
        material,
        layer);

    // Textures
    if (pbr.baseColorTexture) {
        definesValues.push('HAS_TEXTURE_u_baseColorTexture');
        painter.context.activeTexture.set(context.gl.TEXTURE0 + TextureSlots.BaseColor);
        const sampler = pbr.baseColorTexture.sampler;
        if (pbr.baseColorTexture.gfxTexture) {
            pbr.baseColorTexture.gfxTexture.bindExtraParam(sampler.minFilter, sampler.magFilter, sampler.wrapS, sampler.wrapT);
        }
    }

    if (pbr.metallicRoughnessTexture) {
        definesValues.push('HAS_TEXTURE_u_metallicRoughnessTexture');
        painter.context.activeTexture.set(context.gl.TEXTURE0 + TextureSlots.MetallicRoughness);
        const sampler = pbr.metallicRoughnessTexture.sampler;
        if (pbr.metallicRoughnessTexture.gfxTexture) {
            pbr.metallicRoughnessTexture.gfxTexture.bindExtraParam(sampler.minFilter, sampler.magFilter, sampler.wrapS, sampler.wrapT);
        }
    }

    if (material.normalTexture) {
        definesValues.push('HAS_TEXTURE_u_normalTexture');
        painter.context.activeTexture.set(context.gl.TEXTURE0 + TextureSlots.Normal);
        const sampler = material.normalTexture.sampler;
        if (material.normalTexture.gfxTexture) {
            material.normalTexture.gfxTexture.bindExtraParam(sampler.minFilter, sampler.magFilter, sampler.wrapS, sampler.wrapT);
        }
    }

    if (material.occlusionTexture) {
        definesValues.push('HAS_TEXTURE_u_occlusionTexture');
        painter.context.activeTexture.set(context.gl.TEXTURE0 + TextureSlots.Occlusion);
        const sampler = material.occlusionTexture.sampler;
        if (material.occlusionTexture.gfxTexture) {
            material.occlusionTexture.gfxTexture.bindExtraParam(sampler.minFilter, sampler.magFilter, sampler.wrapS, sampler.wrapT);
        }
    }

    if (material.emissionTexture) {
        definesValues.push('HAS_TEXTURE_u_emissionTexture');
        painter.context.activeTexture.set(context.gl.TEXTURE0 + TextureSlots.Emission);
        const sampler = material.emissionTexture.sampler;
        if (material.emissionTexture.gfxTexture) {
            material.emissionTexture.gfxTexture.bindExtraParam(sampler.minFilter, sampler.magFilter, sampler.wrapS, sampler.wrapT);
        }
    }

    // Extra buffers (colors, normals, texCoords)
    const dynamicBuffers = [];
    if (mesh.texcoordBuffer) {
        definesValues.push('HAS_ATTRIBUTE_a_uv_2f');
        dynamicBuffers.push(mesh.texcoordBuffer);
    }
    if (mesh.colorBuffer) {
        const colorDefine = (mesh.colorBuffer.itemSize === 12) ? 'HAS_ATTRIBUTE_a_color_3f' : 'HAS_ATTRIBUTE_a_color_4f';
        definesValues.push(colorDefine);
        dynamicBuffers.push(mesh.colorBuffer);
    }
    if (mesh.normalBuffer) {
        definesValues.push('HAS_ATTRIBUTE_a_normal_3f');
        dynamicBuffers.push(mesh.normalBuffer);
    }

    if (material.alphaMode === 'OPAQUE' || material.alphaMode === 'MASK') {
        definesValues.push('UNPREMULT_TEXTURE_IN_SHADER');
    }

    // just to make the rendertests the same than native
    if (!material.defined) {
        definesValues.push('DIFFUSE_SHADED');
    }

    definesValues.push('USE_STANDARD_DERIVATIVES');

    const program = painter.useProgram('model', null, ((definesValues: any): DynamicDefinesType[]));
    if (painter.style.fog) {
        const fogMatrix = fogMatrixForModel(sortedMesh.nodeModelMatrix, painter.transform);
        definesValues.push('FOG');
        painter.uploadCommonUniforms(context, program, null, new Float32Array(fogMatrix));
    }
    program.draw(context, context.gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.backCCW,
            uniformValues, layer.id, mesh.vertexBuffer, mesh.indexBuffer, mesh.segments, layer.paint, painter.transform.zoom,
            undefined, dynamicBuffers);
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

function prepareMeshes(transform: Transform, node: Node, modelMatrix: Mat4, projectionMatrix: Mat4, modelIndex: number, transparentMeshes: Array<SortedMesh>,  opaqueMeshes: Array<SortedMesh>) {

    let nodeModelMatrix;
    if (transform.projection.name === 'globe') {
        nodeModelMatrix = convertModelMatrixForGlobe(modelMatrix, transform);
    } else {
        nodeModelMatrix = [...modelMatrix];
    }
    mat4.multiply(nodeModelMatrix, nodeModelMatrix, node.matrix);
    const worldViewProjection = mat4.multiply([], projectionMatrix, nodeModelMatrix);
    if (node.meshes) {
        for (const mesh of node.meshes) {
            if (mesh.material.alphaMode !== 'BLEND') {
                const opaqueMesh: SortedMesh = {mesh, depth: 0.0, modelIndex, worldViewProjection, nodeModelMatrix};
                opaqueMeshes.push(opaqueMesh);
                continue;
            }

            const centroidPos = vec3.transformMat4([], mesh.centroid, worldViewProjection);
            // Filter meshes behind the camera
            if (centroidPos[2] > 0.0) {
                const transparentMesh: SortedMesh = {mesh, depth: centroidPos[2], modelIndex, worldViewProjection, nodeModelMatrix};
                transparentMeshes.push(transparentMesh);
            }
        }
    }
    if (node.children) {
        for (const child of node.children) {
            prepareMeshes(transform, child, modelMatrix, projectionMatrix, modelIndex, transparentMeshes, opaqueMeshes);
        }
    }
}

function drawModels(painter: Painter, sourceCache: SourceCache, layer: ModelStyleLayer) {
    if (painter.renderPass !== 'translucent') return;
    const modelSource = sourceCache.getSource();

    if (!modelSource.loaded()) return;
    const models = (modelSource: any).getModels();
    const modelParametersVector: ModelParameters[] = [];

    const mercCameraPos = painter.transform.getFreeCameraOptions().position || new MercatorCoordinate(0, 0, 0);
    const cameraPos = vec3.scale([], [mercCameraPos.x, mercCameraPos.y, mercCameraPos.z], painter.transform.worldSize);
    vec3.negate(cameraPos, cameraPos);
    const transparentMeshes: SortedMesh[] = [];
    const opaqueMeshes: SortedMesh[] = [];
    let modelIndex = 0;
    // Draw models
    for (const model of models) {
        const rotation = layer.paint.get('model-rotation').constantOr((null: any));
        const scale = layer.paint.get('model-scale').constantOr((null: any));
        const translation = layer.paint.get('model-translation').constantOr((null: any));
        // update model matrices
        model.computeModelMatrix(painter, rotation, scale, translation, true, true, false);

        // compute model parameters matrices
        const negCameraPosMatrix = mat4.identity([]);
        const modelMetersPerPixel = getMetersPerPixelAtLatitude(model.position.lat, painter.transform.zoom);
        const modelPixelsPerMeter = 1.0 / modelMetersPerPixel;
        const zScaleMatrix = mat4.fromScaling([], [1.0, 1.0, modelPixelsPerMeter]);
        mat4.translate(negCameraPosMatrix, negCameraPosMatrix, cameraPos);
        const modelParameters = {zScaleMatrix, negCameraPosMatrix};
        modelParametersVector.push(modelParameters);
        for (const node of model.nodes) {
            prepareMeshes(painter.transform, node, model.matrix, painter.transform.projMatrix, modelIndex, transparentMeshes, opaqueMeshes);
        }
        modelIndex++;
    }
    // Sort the transparent meshes by depth
    transparentMeshes.sort((a, b) => {
        return b.depth - a.depth;
    });

    // Draw opaque meshes
    const opacity = layer.paint.get('model-opacity');
    if (opacity === 1) {
        for (const opaqueMesh of opaqueMeshes) {
            drawMesh(opaqueMesh, painter, layer, modelParametersVector[opaqueMesh.modelIndex], StencilMode.disabled, painter.colorModeForRenderPass());
        }
    } else {
        for (const opaqueMesh of opaqueMeshes) {
            // If we have layer opacity draw with two passes opaque meshes
            drawMesh(opaqueMesh, painter, layer, modelParametersVector[opaqueMesh.modelIndex], StencilMode.disabled, ColorMode.disabled);
        }
        for (const opaqueMesh of opaqueMeshes) {
            drawMesh(opaqueMesh, painter, layer, modelParametersVector[opaqueMesh.modelIndex], painter.stencilModeFor3D(), painter.colorModeForRenderPass());
        }
        painter.resetStencilClippingMasks();
    }

    // Draw transparent sorted meshes
    for (const transparentMesh of transparentMeshes) {
        drawMesh(transparentMesh, painter, layer, modelParametersVector[transparentMesh.modelIndex], StencilMode.disabled, painter.colorModeForRenderPass());
    }
}

