// @flow

import type Painter from '../../src/render/painter.js';
import type SourceCache from '../../src/source/source_cache.js';
import type ModelStyleLayer from '../style/style_layer/model_style_layer.js';

import {modelUniformValues, modelDepthUniformValues} from './program/model_program.js';
import type {Mesh, Node} from '../data/model.js';
import {ModelTraits, DefaultModelScale} from '../data/model.js';
import type {DynamicDefinesType} from '../../src/render/program/program_uniforms.js';

import Transform from '../../src/geo/transform.js';
import EXTENT from '../../src/style-spec/data/extent.js';
import StencilMode from '../../src/gl/stencil_mode.js';
import ColorMode from '../../src/gl/color_mode.js';
import DepthMode from '../../src/gl/depth_mode.js';
import CullFaceMode from '../../src/gl/cull_face_mode.js';
import {mat4, vec3} from 'gl-matrix';
import type {Mat4} from 'gl-matrix';
import {getMetersPerPixelAtLatitude} from '../../src/geo/mercator_coordinate.js';
import TextureSlots from './texture_slots.js';
import {convertModelMatrixForGlobe} from '../util/model_util.js';
import {warnOnce} from '../../src/util/util.js';
import ModelBucket from '../data/bucket/model_bucket.js';
import type VertexBuffer from '../../src/gl/vertex_buffer.js';
import Tiled3dModelBucket, {Tiled3dModelFeature} from '../data/bucket/tiled_3d_model_bucket.js';
import assert from 'assert';
import {DEMSampler} from '../../src/terrain/elevation.js';
import {OverscaledTileID} from '../../src/source/tile_id.js';
import {Aabb} from '../../src/util/primitives.js';

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

type RenderData = {
    shadowUniformsInitialized: boolean;
    tileMatrix: Float64Array;
    shadowTileMatrix: Float32Array;
    aabb: Aabb;
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

// Collect defines and dynamic buffers (colors, normals, uv) and bind textures. Used for single mesh and instanced draw.
function setupMeshDraw(definesValues: Array<string>, dynamicBuffers: Array<?VertexBuffer>, mesh: Mesh, painter: Painter) {
    const material = mesh.material;
    const pbr = material.pbrMetallicRoughness;
    const context = painter.context;

    // Textures
    if (pbr.baseColorTexture) {
        definesValues.push('HAS_TEXTURE_u_baseColorTexture');
        context.activeTexture.set(context.gl.TEXTURE0 + TextureSlots.BaseColor);
        const sampler = pbr.baseColorTexture.sampler;
        if (pbr.baseColorTexture.gfxTexture) {
            pbr.baseColorTexture.gfxTexture.bindExtraParam(sampler.minFilter, sampler.magFilter, sampler.wrapS, sampler.wrapT);
        }
    }

    if (pbr.metallicRoughnessTexture) {
        definesValues.push('HAS_TEXTURE_u_metallicRoughnessTexture');
        context.activeTexture.set(context.gl.TEXTURE0 + TextureSlots.MetallicRoughness);
        const sampler = pbr.metallicRoughnessTexture.sampler;
        if (pbr.metallicRoughnessTexture.gfxTexture) {
            pbr.metallicRoughnessTexture.gfxTexture.bindExtraParam(sampler.minFilter, sampler.magFilter, sampler.wrapS, sampler.wrapT);
        }
    }

    if (material.normalTexture) {
        definesValues.push('HAS_TEXTURE_u_normalTexture');
        context.activeTexture.set(context.gl.TEXTURE0 + TextureSlots.Normal);
        const sampler = material.normalTexture.sampler;
        if (material.normalTexture.gfxTexture) {
            material.normalTexture.gfxTexture.bindExtraParam(sampler.minFilter, sampler.magFilter, sampler.wrapS, sampler.wrapT);
        }
    }

    if (material.occlusionTexture) {
        definesValues.push('HAS_TEXTURE_u_occlusionTexture');
        context.activeTexture.set(context.gl.TEXTURE0 + TextureSlots.Occlusion);
        const sampler = material.occlusionTexture.sampler;
        if (material.occlusionTexture.gfxTexture) {
            material.occlusionTexture.gfxTexture.bindExtraParam(sampler.minFilter, sampler.magFilter, sampler.wrapS, sampler.wrapT);
        }
    }

    if (material.emissionTexture) {
        definesValues.push('HAS_TEXTURE_u_emissionTexture');
        context.activeTexture.set(context.gl.TEXTURE0 + TextureSlots.Emission);
        const sampler = material.emissionTexture.sampler;
        if (material.emissionTexture.gfxTexture) {
            material.emissionTexture.gfxTexture.bindExtraParam(sampler.minFilter, sampler.magFilter, sampler.wrapS, sampler.wrapT);
        }
    }

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

    if (mesh.pbrBuffer) {
        definesValues.push('HAS_ATTRIBUTE_a_pbr');
        definesValues.push('HAS_ATTRIBUTE_a_heightBasedEmissiveStrength');
        dynamicBuffers.push(mesh.pbrBuffer);
    }

    if (material.alphaMode === 'OPAQUE' || material.alphaMode === 'MASK') {
        definesValues.push('UNPREMULT_TEXTURE_IN_SHADER');
    }

    // just to make the rendertests the same than native
    if (!material.defined) {
        definesValues.push('DIFFUSE_SHADED');
    }

    definesValues.push('USE_STANDARD_DERIVATIVES');
}

function drawMesh(sortedMesh: SortedMesh, painter: Painter, layer: ModelStyleLayer, modelParameters: ModelParameters, stencilMode: StencilMode, colorMode: ColorMode) {
    const opacity = layer.paint.get('model-opacity');
    assert(opacity > 0);
    const context = painter.context;
    const depthMode = new DepthMode(painter.context.gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D);

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

    const definesValues = [];
    // Extra buffers (colors, normals, texCoords)
    const dynamicBuffers = [];

    setupMeshDraw(definesValues, dynamicBuffers, mesh, painter);
    const shadowRenderer = painter.shadowRenderer;
    if (shadowRenderer) { shadowRenderer.useNormalOffset = false; }

    const program = painter.useProgram('model', null, ((definesValues: any): DynamicDefinesType[]));
    let fogMatrixArray = null;
    if (painter.style.fog) {
        const fogMatrix = fogMatrixForModel(sortedMesh.nodeModelMatrix, painter.transform);
        definesValues.push('FOG', 'FOG_DITHERING');
        fogMatrixArray = new Float32Array(fogMatrix);
    }

    painter.uploadCommonUniforms(context, program, null, fogMatrixArray);

    const isShadowPass = painter.renderPass === 'shadow';

    if (!isShadowPass && shadowRenderer) {
        shadowRenderer.setupShadowsFromMatrix(sortedMesh.nodeModelMatrix, program);
    }

    program.draw(painter, context.gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.backCCW,
            uniformValues, layer.id, mesh.vertexBuffer, mesh.indexBuffer, mesh.segments, layer.paint, painter.transform.zoom,
            undefined, dynamicBuffers);
}

export function upload(painter: Painter, sourceCache: SourceCache, scope: string) {
    const modelSource = sourceCache.getSource();
    if (!modelSource.loaded()) return;
    if (modelSource.type === 'vector' || modelSource.type === 'geojson') {
        if (painter.modelManager) {
            // Do it here, to prevent modelManager handling in Painter.
            painter.modelManager.upload(painter, scope);
        }
        return;
    }
    if (modelSource.type === 'batched-model') {
        // batched models uploads happen in tile_3d_bucket
        return;
    }
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

function drawShadowCaster(mesh: Mesh, matrix: Mat4, painter: Painter, layer: ModelStyleLayer) {
    const shadowRenderer = painter.shadowRenderer;
    if (!shadowRenderer) return;
    const depthMode = shadowRenderer.getShadowPassDepthMode();
    const colorMode = shadowRenderer.getShadowPassColorMode();
    const shadowMatrix = shadowRenderer.calculateShadowPassMatrixFromMatrix(matrix);
    const uniformValues = modelDepthUniformValues(shadowMatrix);
    const definesValues = ['DEPTH_TEXTURE'];
    const program = painter.useProgram('modelDepth', null, ((definesValues: any): DynamicDefinesType[]));
    const context = painter.context;
    program.draw(painter, context.gl.TRIANGLES, depthMode, StencilMode.disabled, colorMode, CullFaceMode.backCCW,
            uniformValues, layer.id, mesh.vertexBuffer, mesh.indexBuffer, mesh.segments, layer.paint, painter.transform.zoom,
            undefined, undefined);
}

function drawModels(painter: Painter, sourceCache: SourceCache, layer: ModelStyleLayer, coords: Array<OverscaledTileID>) {
    if (painter.renderPass === 'opaque') {
        return;
    }
    // early return if totally transparent
    const opacity = layer.paint.get('model-opacity');
    if (opacity === 0) {
        return;
    }
    const castShadows = layer.paint.get('model-cast-shadows');
    if (painter.renderPass === 'shadow' && !castShadows) {
        return;
    }
    const shadowRenderer = painter.shadowRenderer;
    const receiveShadows = layer.paint.get('model-receive-shadows');
    if (shadowRenderer) {
        shadowRenderer.useNormalOffset = true;
        if (!receiveShadows) {
            shadowRenderer.enabled = false;
        }
    }
    const cleanup = () => {
        if (shadowRenderer) {
            shadowRenderer.useNormalOffset = true;
            if (!receiveShadows) {
                shadowRenderer.enabled = true;
            }
        }
    };

    const modelSource = sourceCache.getSource();
    if (painter.renderPass === 'light-beam' && modelSource.type !== 'batched-model') {
        return;
    }

    if (!modelSource.loaded()) return;
    if (modelSource.type === 'vector' || modelSource.type === 'geojson') {
        drawInstancedModels(painter, sourceCache, layer, coords);
        cleanup();
        return;
    }
    if (modelSource.type === 'batched-model') {
        drawBatchedModels(painter, sourceCache, layer, coords);
        cleanup();
        return;
    }
    const models = (modelSource: any).getModels();
    const modelParametersVector: ModelParameters[] = [];

    const mercCameraPos = (painter.transform.getFreeCameraOptions().position: any);
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

    if (painter.renderPass === 'shadow') {
        for (const opaqueMesh of opaqueMeshes) {
            drawShadowCaster(opaqueMesh.mesh, opaqueMesh.nodeModelMatrix, painter, layer);
        }
        // Draw transparent sorted meshes
        for (const transparentMesh of transparentMeshes) {
            drawShadowCaster(transparentMesh.mesh, transparentMesh.nodeModelMatrix, painter, layer);
        }
        // Finish the render pass
        cleanup();
        return;
    }

    // Draw opaque meshes
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
    cleanup();
}

// If terrain changes, update elevations (baked in translation).
function updateModelBucketsElevation(painter: Painter, bucket: ModelBucket, bucketTileID: OverscaledTileID) {
    let exaggeration = painter.terrain ? painter.terrain.exaggeration() : 0;
    let dem: ?DEMSampler;
    if (painter.terrain && exaggeration > 0) {
        const terrain = painter.terrain;
        const demTile = terrain.findDEMTileFor(bucketTileID);
        if (demTile && demTile.dem) {
            dem = DEMSampler.create(terrain, bucketTileID, demTile);
        } else {
            exaggeration = 0;
        }
    }

    if (exaggeration === 0) {
        bucket.terrainElevationMin = 0;
        bucket.terrainElevationMax = 0;
    }

    if (exaggeration === bucket.validForExaggeration &&
        (exaggeration === 0 || (dem && dem._demTile && dem._demTile.tileID === bucket.validForDEMTile))) {
        return;
    }

    let elevationMin: ?number;
    let elevationMax: ?number;

    for (const modelId in bucket.instancesPerModel) {
        const instances = bucket.instancesPerModel[modelId];
        assert(instances.instancedDataArray.bytesPerElement === 64);
        for (let i = 0; i < instances.instancedDataArray.length; ++i) {
            const x = instances.instancedDataArray.float32[i * 16] | 0;
            const y = instances.instancedDataArray.float32[i * 16 + 1] | 0;
            const elevation = (dem ? exaggeration * dem.getElevationAt(x, y, true, true) : 0) + instances.instancesEvaluatedElevation[i];
            instances.instancedDataArray.float32[i * 16 + 6] = elevation;
            elevationMin = elevationMin ? Math.min(bucket.terrainElevationMin, elevation) : elevation;
            elevationMax = elevationMax ? Math.max(bucket.terrainElevationMax, elevation) : elevation;
        }
    }

    bucket.terrainElevationMin = elevationMin ? elevationMin : 0;
    bucket.terrainElevationMax = elevationMax ? elevationMax : 0;

    bucket.validForExaggeration = exaggeration;
    bucket.validForDEMTile = dem && dem._demTile ? dem._demTile.tileID : undefined;
    bucket.uploaded = false;
    bucket.upload(painter.context);
}

// preallocate structure used to reduce re-allocation during rendering and flow checks
const renderData: RenderData = {
    shadowUniformsInitialized: false,
    tileMatrix: new Float64Array(16),
    shadowTileMatrix: new Float32Array(16),
    aabb: new Aabb([0, 0, 0], [EXTENT, EXTENT, 0])
};

function drawInstancedModels(painter: Painter, source: SourceCache, layer: ModelStyleLayer, coords: Array<OverscaledTileID>) {
    const tr = painter.transform;
    if (tr.projection.name !== 'mercator') {
        warnOnce(`Drawing 3D models for ${tr.projection.name} projection is not yet implemented`);
        return;
    }

    const mercCameraPos = (tr.getFreeCameraOptions().position: any);
    //  LOD computation done in 2D space (terrain not taken into account).
    const mercCameraPosVec = [mercCameraPos.x, mercCameraPos.y, mercCameraPos.z - tr.pixelsPerMeter / tr.worldSize * tr._centerAltitude];
    const forward = painter.transform._camera.forward();
    const distanceXYZ = [0, 0, 0];
    const tilePos = [0, 0, 0];

    if (!painter.modelManager) return;
    const modelManager = painter.modelManager;
    if (!layer._unevaluatedLayout._values.hasOwnProperty('model-id')) return;
    const modelIdUnevaluatedProperty = layer._unevaluatedLayout._values['model-id'];
    const evaluationParameters = {...layer.layout.get("model-id").parameters};

    for (const coord of coords) {
        const tile = source.getTile(coord);
        const bucket: ?ModelBucket = (tile.getBucket(layer): any);
        if (!bucket || bucket.projection.name !== tr.projection.name) continue;
        let tileZoom = bucket.zoom;
        // Distance from camera plane to point of a tile closest to camera to calculate effective zoom.
        // To be more aggressive on zooms just above integer zooms, selected point it not the corner but
        // a point between center and tile corner
        tilePos[0] = coord.wrap + (coord.canonical.x + (painter.transform.bearing < 0 ? 0.75 : 0.25)) / (1 << coord.canonical.z);
        tilePos[1] = (coord.canonical.y + (Math.abs(painter.transform.bearing) < 90 ? 0.75 : 0.25)) / (1 << coord.canonical.z);
        vec3.sub(distanceXYZ, tilePos, mercCameraPosVec);
        const dist = Math.max(0., vec3.dot(distanceXYZ, forward));
        tileZoom = painter.transform._zoomFromMercatorZ(dist);
        const largeTileCutoff = 400;
        if (painter.transform.pitch > 30 && tileZoom < painter.transform.zoom && bucket.instanceCount > largeTileCutoff) {
            tileZoom -= 0.5; // further reduce LOD for large tiles further above the center
        }
        evaluationParameters.zoom = tileZoom;
        const modelIdProperty = modelIdUnevaluatedProperty.possiblyEvaluate(evaluationParameters);

        updateModelBucketsElevation(painter, bucket, coord);

        renderData.shadowUniformsInitialized = false;
        if (painter.renderPass === 'shadow' && painter.shadowRenderer) {
            const shadowRenderer = painter.shadowRenderer;
            if (painter.currentShadowCascade === 1 && bucket.isInsideFirstShadowMapFrustum) continue;

            const tileMatrix = tr.calculatePosMatrix(coord.toUnwrapped(), tr.worldSize);
            renderData.tileMatrix.set(tileMatrix);
            renderData.shadowTileMatrix = Float32Array.from(shadowRenderer.calculateShadowPassMatrixFromMatrix(tileMatrix));
            renderData.aabb.min.fill(0);
            renderData.aabb.max[0] = renderData.aabb.max[1] = EXTENT;
            renderData.aabb.max[2] = 0;
            if (calculateTileShadowPassCulling(bucket, renderData, painter, layer.scope)) continue;
        }

        // camera position in the tile coordinates
        let cameraPos = vec3.scale([], mercCameraPosVec, (1 << coord.canonical.z));
        cameraPos = [(cameraPos[0] - coord.canonical.x - coord.wrap * (1 << coord.canonical.z)) * EXTENT,
            (cameraPos[1] - coord.canonical.y) * EXTENT, cameraPos[2] * EXTENT];

        for (let modelId in bucket.instancesPerModel) {
            // From effective tile zoom (distance to camera) and calculate model to use.
            const modelInstances = bucket.instancesPerModel[modelId];
            if (modelInstances.features.length > 0) {
                modelId = modelIdProperty.evaluate(modelInstances.features[0].feature, {});
            }
            const model = modelManager.getModel(modelId, layer.scope);
            if (!model) continue;
            for (const node of model.nodes) {
                drawInstancedNode(painter, layer, node, modelInstances, cameraPos, coord, renderData);
            }
        }
    }
}

function drawInstancedNode(painter: Painter, layer: ModelStyleLayer, node: Node, modelInstances: any, cameraPos: [number, number, number], coord: OverscaledTileID, renderData: RenderData) {
    const context = painter.context;
    const isShadowPass = painter.renderPass === 'shadow';
    const shadowRenderer = painter.shadowRenderer;
    const depthMode = isShadowPass && shadowRenderer ? shadowRenderer.getShadowPassDepthMode() : new DepthMode(context.gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D);
    const colorMode = isShadowPass && shadowRenderer ? shadowRenderer.getShadowPassColorMode() : painter.colorModeForRenderPass();

    if (node.meshes) {
        for (const mesh of node.meshes) {
            const definesValues = ['MODEL_POSITION_ON_GPU'];
            const dynamicBuffers = [];
            let program;
            let uniformValues;

            if (isShadowPass && shadowRenderer) {
                program = painter.useProgram('modelDepth', null, ((definesValues: any): DynamicDefinesType[]));
                uniformValues = modelDepthUniformValues(renderData.shadowTileMatrix, renderData.shadowTileMatrix, Float32Array.from(node.matrix));
            } else {
                setupMeshDraw(definesValues, dynamicBuffers, mesh, painter);
                program = painter.useProgram('model', null, ((definesValues: any): DynamicDefinesType[]));
                const material = mesh.material;
                const pbr = material.pbrMetallicRoughness;

                uniformValues = modelUniformValues(
                    coord.projMatrix,
                    Float32Array.from(node.matrix),
                    new Float32Array(16),
                    painter,
                    layer.paint.get('model-opacity'),
                    pbr.baseColorFactor,
                    material.emissiveFactor,
                    pbr.metallicFactor,
                    pbr.roughnessFactor,
                    material,
                    layer,
                    cameraPos);
                if (shadowRenderer) {
                    if (!renderData.shadowUniformsInitialized) {
                        shadowRenderer.setupShadows(coord.toUnwrapped(), program, 'model-tile', coord.overscaledZ);
                        renderData.shadowUniformsInitialized = true;
                    } else {
                        program.setShadowUniformValues(context, shadowRenderer.getShadowUniformValues());
                    }
                }
            }

            painter.uploadCommonUniforms(context, program, coord.toUnwrapped());

            assert(modelInstances.instancedDataArray.bytesPerElement === 64);
            const instanceUniform = isShadowPass ? "u_instance" : "u_normal_matrix";
            for (let i = 0; i < modelInstances.instancedDataArray.length; ++i) {
                /* $FlowIgnore[prop-missing] modelDepth uses u_instance and model uses u_normal_matrix for packing instance data */
                uniformValues[instanceUniform] = new Float32Array(modelInstances.instancedDataArray.arrayBuffer, i * 64, 16);
                program.draw(painter, context.gl.TRIANGLES, depthMode, StencilMode.disabled, colorMode, CullFaceMode.disabled,
                uniformValues, layer.id, mesh.vertexBuffer, mesh.indexBuffer, mesh.segments, layer.paint, painter.transform.zoom,
                undefined, dynamicBuffers);
            }
        }
    }
    if (node.children) {
        for (const child of node.children) {
            drawInstancedNode(painter, layer, child, modelInstances, cameraPos, coord, renderData);
        }
    }
}

const normalScale = [1.0, -1.0, 1.0];

function drawBatchedNode(nodeInfo: Tiled3dModelFeature, modelTraits: number, painter: Painter, layer: ModelStyleLayer, coord: OverscaledTileID, tileMatrix: Mat4, zScaleMatrix: Mat4, negCameraPosMatrix: Mat4) {
    if (painter.renderPass === 'opaque') {
        return;
    }

    const node = nodeInfo.node;
    const context = painter.context;
    const isLightBeamPass = painter.renderPass === 'light-beam';

    const modelMatrix = [...tileMatrix];
    for (let i = 0; i < node.meshes.length; ++i) {
        const mesh = node.meshes[i];
        const isLight = i === node.lightMeshIndex;
        if (isLight) {
            if (!isLightBeamPass && !painter.terrain && painter.shadowRenderer) {
                if (painter.currentLayer < painter.firstLightBeamLayer) {
                    painter.firstLightBeamLayer = painter.currentLayer;
                }
                continue;
            }
        } else if (isLightBeamPass) {
            continue;
        }

        const definesValues = [];
        const dynamicBuffers = [];
        setupMeshDraw(definesValues, dynamicBuffers, mesh, painter);

        if (!(modelTraits & ModelTraits.HasMapboxMeshFeatures)) {
            definesValues.push('DIFFUSE_SHADED');
        }

        const scale = nodeInfo.evaluatedScale;
        let elevation = 0;
        if (painter.terrain && node.elevation) {
            elevation = node.elevation * painter.terrain.exaggeration();
        }
        const anchorX = node.anchor ? node.anchor[0] : 0;
        const anchorY = node.anchor ? node.anchor[1] : 0;

        mat4.translate(modelMatrix, modelMatrix, [anchorX * (scale[0] - 1),
            anchorY * (scale[1] - 1),
            elevation]);
        if (scale !== DefaultModelScale) {
            /* $FlowIgnore[incompatible-call] scale should always be an array */
            mat4.scale(modelMatrix, modelMatrix, scale);
        }

        mat4.multiply(modelMatrix, modelMatrix, node.matrix);
        const isShadowPass = painter.renderPass === 'shadow';
        if (isShadowPass) {
            drawShadowCaster(mesh, modelMatrix, painter, layer);
            return;
        }

        let fogMatrixArray = null;
        if (painter.style.fog) {
            const fogMatrix = fogMatrixForModel(modelMatrix, painter.transform);
            definesValues.push('FOG', 'FOG_DITHERING');
            fogMatrixArray = new Float32Array(fogMatrix);
        }
        const program = painter.useProgram('model', null, ((definesValues: any): DynamicDefinesType[]));

        const lightingMatrix = mat4.multiply([], zScaleMatrix, modelMatrix);
        mat4.multiply(lightingMatrix, negCameraPosMatrix, lightingMatrix);
        const normalMatrix = mat4.invert([], lightingMatrix);
        mat4.transpose(normalMatrix, normalMatrix);
        mat4.scale(normalMatrix, normalMatrix, normalScale);

        const worldViewProjection = mat4.multiply([], painter.transform.projMatrix, modelMatrix);

        const shadowRenderer = painter.shadowRenderer;

        if (!isShadowPass && shadowRenderer) {
            shadowRenderer.useNormalOffset = !!mesh.normalBuffer;
            shadowRenderer.setupShadowsFromMatrix(modelMatrix, program, shadowRenderer.useNormalOffset);
        }

        painter.uploadCommonUniforms(context, program, coord.toUnwrapped(), fogMatrixArray);

        const material = mesh.material;
        const pbr = material.pbrMetallicRoughness;
        // These values were taken from the tilesets used for testing
        pbr.metallicFactor = 0.9;
        pbr.roughnessFactor = 0.5;

        const uniformValues = modelUniformValues(
                new Float32Array(worldViewProjection),
                new Float32Array(lightingMatrix),
                new Float32Array(normalMatrix),
                painter,
                layer.paint.get('model-opacity'),
                pbr.baseColorFactor,
                material.emissiveFactor,
                pbr.metallicFactor,
                pbr.roughnessFactor,
                material,
                layer
        );
        const depthMode = new DepthMode(context.gl.LEQUAL, isLight ? DepthMode.ReadOnly : DepthMode.ReadWrite, painter.depthRangeFor3D);

        program.draw(painter, context.gl.TRIANGLES, depthMode, StencilMode.disabled, painter.colorModeForRenderPass(), CullFaceMode.backCCW,
            uniformValues, layer.id, mesh.vertexBuffer, mesh.indexBuffer, mesh.segments, layer.paint, painter.transform.zoom,
            undefined, dynamicBuffers);
    }
}

function prepareBatched(painter: Painter, source: SourceCache, layer: ModelStyleLayer, coords: Array<OverscaledTileID>) {
    const exaggeration = painter.terrain ? painter.terrain.exaggeration() : 0;
    const zoom = painter.transform.zoom;
    for (const coord of coords) {
        const tile = source.getTile(coord);
        const bucket: ?Tiled3dModelBucket = (tile.getBucket(layer): any);
        if (!bucket) continue;
        // Conflation
        if (painter.conflationActive) bucket.updateReplacement(coord, painter.replacementSource);
        // evaluate scale
        bucket.evaluateScale(painter, layer);
        // Compute elevation
        if (painter.terrain && exaggeration > 0) {
            bucket.elevationUpdate(painter.terrain, exaggeration, coord);
        }
        if (bucket.needsReEvaluation(painter, zoom, layer)) {
            bucket.evaluate(layer);
        }

    }
}

function drawBatchedModels(painter: Painter, source: SourceCache, layer: ModelStyleLayer, coords: Array<OverscaledTileID>) {
    const tr = painter.transform;
    if (tr.projection.name !== 'mercator') {
        warnOnce(`Drawing 3D landmark models for ${tr.projection.name} projection is not yet implemented`);
        return;
    }

    const mercCameraPos = (painter.transform.getFreeCameraOptions().position: any);
    const cameraPos = vec3.scale([], [mercCameraPos.x, mercCameraPos.y, mercCameraPos.z], painter.transform.worldSize);
    vec3.negate(cameraPos, cameraPos);
    // compute model parameters matrices
    const negCameraPosMatrix = mat4.identity([]);
    const metersPerPixel = getMetersPerPixelAtLatitude(tr.center.lat, tr.zoom);
    const pixelsPerMeter = 1.0 / metersPerPixel;
    const zScaleMatrix = mat4.fromScaling([], [1.0, 1.0, pixelsPerMeter]);
    mat4.translate(negCameraPosMatrix, negCameraPosMatrix, cameraPos);

    // Evaluate bucket and prepare for rendering
    prepareBatched(painter, source, layer, coords);

    for (const coord of coords) {
        const tile = source.getTile(coord);
        const bucket: ?Tiled3dModelBucket = (tile.getBucket(layer): any);
        if (!bucket || !bucket.uploaded) continue;
        const tileMatrix = tr.calculatePosMatrix(coord.toUnwrapped(), tr.worldSize);
        const nodesInfo = bucket.getNodesInfo();
        for (const nodeInfo of nodesInfo) {
            if (nodeInfo.hiddenByReplacement) continue;
            if (!nodeInfo.node.meshes) continue;
            drawBatchedNode(nodeInfo, bucket.modelTraits, painter, layer, coord, tileMatrix, zScaleMatrix, negCameraPosMatrix);
        }
    }
}

function calculateTileShadowPassCulling(bucket: ModelBucket, renderData: RenderData, painter: Painter, scope: string) {
    if (!painter.modelManager) return true;
    const modelManager = painter.modelManager;
    if (!painter.shadowRenderer) return true;
    const shadowRenderer = painter.shadowRenderer;
    assert(painter.renderPass === 'shadow');
    const aabb = renderData.aabb;
    let allModelsLoaded = true;
    let maxHeight = bucket.maxHeight;
    if (maxHeight === 0) {
        let maxDim = 0;
        for (const modelId in bucket.instancesPerModel) {
            const model = modelManager.getModel(modelId, scope);
            if (!model) {
                allModelsLoaded = false;
                continue;
            }
            maxDim = Math.max(maxDim, Math.max(Math.max(model.aabb.max[0], model.aabb.max[1]), model.aabb.max[2]));
        }
        maxHeight = bucket.maxScale * maxDim * 1.41 + bucket.maxVerticalOffset;
        if (allModelsLoaded) bucket.maxHeight = maxHeight;
    }
    aabb.max[2] = maxHeight;

    // Take into account bucket placement on DEM
    aabb.min[2] += bucket.terrainElevationMin;
    aabb.max[2] += bucket.terrainElevationMax;

    vec3.transformMat4(aabb.min, aabb.min, renderData.tileMatrix);
    vec3.transformMat4(aabb.max, aabb.max, renderData.tileMatrix);
    const intersection = aabb.intersects(shadowRenderer.getCurrentCascadeFrustum());
    if (painter.currentShadowCascade === 0) {
        bucket.isInsideFirstShadowMapFrustum = intersection === 2;
    }
    return intersection === 0;
}

