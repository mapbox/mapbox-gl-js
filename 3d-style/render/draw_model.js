// @flow

import {modelUniformValues, modelDepthUniformValues} from './program/model_program.js';
import {ModelTraits, DefaultModelScale} from '../data/model.js';

import Transform from '../../src/geo/transform.js';
import EXTENT from '../../src/style-spec/data/extent.js';
import StencilMode from '../../src/gl/stencil_mode.js';
import ColorMode from '../../src/gl/color_mode.js';
import DepthMode from '../../src/gl/depth_mode.js';
import CullFaceMode from '../../src/gl/cull_face_mode.js';
import {mat4, vec3} from 'gl-matrix';
import {getMetersPerPixelAtLatitude, mercatorZfromAltitude} from '../../src/geo/mercator_coordinate.js';
import TextureSlots from './texture_slots.js';
import {convertModelMatrixForGlobe} from '../util/model_util.js';
import {clamp, warnOnce} from '../../src/util/util.js';
import ModelBucket from '../data/bucket/model_bucket.js';
import assert from 'assert';
import {DEMSampler} from '../../src/terrain/elevation.js';
import {OverscaledTileID} from '../../src/source/tile_id.js';
import {Aabb} from '../../src/util/primitives.js';
import {getCutoffParams} from '../../src/render/cutoff.js';
import {FOG_OPACITY_THRESHOLD} from '../../src/style/fog_helpers.js';
import {ZoomDependentExpression} from '../../src/style-spec/expression/index.js';

import type Tiled3dModelBucket from '../data/bucket/tiled_3d_model_bucket.js';
import type Painter from '../../src/render/painter.js';
import type {CreateProgramParams} from '../../src/render/painter.js';
import type SourceCache from '../../src/source/source_cache.js';
import type ModelStyleLayer from '../style/style_layer/model_style_layer.js';
import type {Mesh, Node, ModelTexture} from '../data/model.js';
import type {DynamicDefinesType} from '../../src/render/program/program_uniforms.js';
import type {Mat4} from 'gl-matrix';
import type VertexBuffer from '../../src/gl/vertex_buffer.js';

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
    useSingleShadowCascade: boolean;
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
    const context = painter.context;

    const {baseColorTexture, metallicRoughnessTexture} = material.pbrMetallicRoughness;
    const {normalTexture, occlusionTexture, emissionTexture} = material;

    function setupTexture(texture: ?ModelTexture, define: string, slot: number) {
        if (!texture) return;

        definesValues.push(define);
        context.activeTexture.set(context.gl.TEXTURE0 + slot);
        if (texture.gfxTexture) {
            const {minFilter, magFilter, wrapS, wrapT} = texture.sampler;
            texture.gfxTexture.bindExtraParam(minFilter, magFilter, wrapS, wrapT);
        }
    }

    // Textures
    setupTexture(baseColorTexture, 'HAS_TEXTURE_u_baseColorTexture', TextureSlots.BaseColor);
    setupTexture(metallicRoughnessTexture, 'HAS_TEXTURE_u_metallicRoughnessTexture', TextureSlots.MetallicRoughness);
    setupTexture(normalTexture, 'HAS_TEXTURE_u_normalTexture', TextureSlots.Normal);
    setupTexture(occlusionTexture, 'HAS_TEXTURE_u_occlusionTexture', TextureSlots.Occlusion);
    setupTexture(emissionTexture, 'HAS_TEXTURE_u_emissionTexture', TextureSlots.Emission);

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
    const tr = painter.transform;

    const mesh = sortedMesh.mesh;
    const material = mesh.material;
    const pbr = material.pbrMetallicRoughness;
    const fog = painter.style.fog;

    let lightingMatrix;
    if (painter.transform.projection.zAxisUnit === "pixels") {
        lightingMatrix = [...sortedMesh.nodeModelMatrix];
    } else {
        lightingMatrix = mat4.multiply([], modelParameters.zScaleMatrix, sortedMesh.nodeModelMatrix);
    }
    mat4.multiply(lightingMatrix, modelParameters.negCameraPosMatrix, lightingMatrix);
    const normalMatrix = mat4.invert([], lightingMatrix);
    mat4.transpose(normalMatrix, normalMatrix);

    const emissiveStrength = layer.paint.get('model-emissive-strength').constantOr(0.0);

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
        emissiveStrength,
        layer);

    const programOptions: CreateProgramParams = {
        defines: []
    };

    // Extra buffers (colors, normals, texCoords)
    const dynamicBuffers = [];

    setupMeshDraw(((programOptions.defines: any): Array<string>), dynamicBuffers, mesh, painter);
    const shadowRenderer = painter.shadowRenderer;
    if (shadowRenderer) { shadowRenderer.useNormalOffset = false; }

    let fogMatrixArray = null;
    if (fog) {
        const fogMatrix = fogMatrixForModel(sortedMesh.nodeModelMatrix, painter.transform);
        fogMatrixArray = new Float32Array(fogMatrix);

        if (tr.projection.name !== 'globe') {
            const min = mesh.aabb.min;
            const max = mesh.aabb.max;
            const [minOpacity, maxOpacity] = fog.getOpacityForBounds(fogMatrix, min[0], min[1], max[0], max[1]);
            programOptions.overrideFog = minOpacity >= FOG_OPACITY_THRESHOLD || maxOpacity >= FOG_OPACITY_THRESHOLD;
        }
    }

    const cutoffParams = getCutoffParams(painter, layer.paint.get('model-cutoff-fade-range'));
    if (cutoffParams.shouldRenderCutoff) {
        (programOptions.defines: any).push('RENDER_CUTOFF');
    }

    const program = painter.getOrCreateProgram('model', programOptions);

    painter.uploadCommonUniforms(context, program, null, fogMatrixArray, cutoffParams);

    const isShadowPass = painter.renderPass === 'shadow';

    if (!isShadowPass && shadowRenderer) {
        shadowRenderer.setupShadowsFromMatrix(sortedMesh.nodeModelMatrix, program);
    }

    const cullFaceMode = mesh.material.doubleSided ? CullFaceMode.disabled : CullFaceMode.backCCW;

    program.draw(painter, context.gl.TRIANGLES, depthMode, stencilMode, colorMode, cullFaceMode,
            uniformValues, layer.id, mesh.vertexBuffer, mesh.indexBuffer, mesh.segments, layer.paint, painter.transform.zoom,
            undefined, dynamicBuffers);
}

export function prepare(layer: ModelStyleLayer, sourceCache: SourceCache, painter: Painter) {
    const modelSource = sourceCache.getSource();
    if (!modelSource.loaded()) return;
    if (modelSource.type === 'vector' || modelSource.type === 'geojson') {
        const scope = modelSource.type === 'vector' ? layer.scope : "";
        if (painter.modelManager) {
            // Do it here, to prevent modelManager handling in Painter.
            // geojson models are always set in the root scope to avoid model duplication
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
    const definesValues = (painter._shadowMapDebug) ? [] : ['DEPTH_TEXTURE'];
    const program = painter.getOrCreateProgram('modelDepth', {defines: ((definesValues: any): DynamicDefinesType[])});
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
    if (painter.renderPass === 'shadow') {
        if (!castShadows) {
            return;
        }
        if (painter.terrain) {
            const noShadowCutoff = 0.65;
            if (opacity < noShadowCutoff) {
                const expression = layer._transitionablePaint._values['model-opacity'].value.expression;
                if (expression instanceof ZoomDependentExpression) {
                    // avoid rendering shadows during fade in / fade out on terrain
                    return;
                }
            }
        }
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

    if (modelSource.type === 'vector' || modelSource.type === 'geojson') {
        const scope = modelSource.type === 'vector' ? layer.scope : "";
        drawVectorLayerModels(painter, sourceCache, layer, coords, scope);
        cleanup();
        return;
    }

    if (!modelSource.loaded()) return;

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
            prepareMeshes(painter.transform, node, model.matrix, painter.transform.expandedFarZProjMatrix, modelIndex, transparentMeshes, opaqueMeshes);
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
function updateModelBucketsElevation(painter: Painter, bucket: ModelBucket, bucketTileID: OverscaledTileID): boolean {
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
        (exaggeration === 0 || (dem && dem._demTile && dem._demTile.tileID === bucket.validForDEMTile.id && dem._dem._timestamp === bucket.validForDEMTile.timestamp))) {
        return false;
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
    bucket.validForDEMTile = dem && dem._demTile ? {id: dem._demTile.tileID, timestamp: dem._dem._timestamp} : {id: undefined, timestamp: 0};

    return true;
}

function updateModelBucketData(painter: Painter, bucket: ModelBucket, bucketTileID: OverscaledTileID) {
    const bucketContentsUpdatedByZoom = bucket.updateZoomBasedPaintProperties();
    const bucketContentsUpdatedByElevation = updateModelBucketsElevation(painter, bucket, bucketTileID);

    if (bucketContentsUpdatedByZoom || bucketContentsUpdatedByElevation) {
        bucket.uploaded = false;
        bucket.upload(painter.context);
    }
}

// preallocate structure used to reduce re-allocation during rendering and flow checks
const renderData: RenderData = {
    shadowUniformsInitialized: false,
    useSingleShadowCascade: false,
    tileMatrix: new Float64Array(16),
    shadowTileMatrix: new Float32Array(16),
    aabb: new Aabb([0, 0, 0], [EXTENT, EXTENT, 0])
};

function calculateTileZoom(id: OverscaledTileID, tr: Transform): number {
    const tiles = 1 << id.canonical.z;
    const cameraPos = (tr.getFreeCameraOptions().position: any);
    const elevation = tr.elevation;

    // Compute tile zoom from the distance between the camera and
    // the closest point on either tile's bottom plane or on a plane
    // elevated to center altitude, whichever is higher. Using center altitude
    // allows us to compensate tall tiles that have high variance in
    // instance placement on z-axis.
    const minx = id.canonical.x / tiles;
    const maxx = (id.canonical.x + 1) / tiles;
    const miny = id.canonical.y / tiles;
    const maxy = (id.canonical.y + 1) / tiles;
    let height = tr._centerAltitude;

    if (elevation) {
        const minmax = elevation.getMinMaxForTile(id);

        if (minmax && minmax.max > height) {
            height = minmax.max;
        }
    }

    const distx = clamp(cameraPos.x, minx, maxx) - cameraPos.x;
    const disty = clamp(cameraPos.y, miny, maxy) - cameraPos.y;
    const distz = mercatorZfromAltitude(height, tr.center.lat) - cameraPos.z;

    return tr._zoomFromMercatorZ(Math.sqrt(distx * distx + disty * disty + distz * distz));
}

function drawVectorLayerModels(painter: Painter, source: SourceCache, layer: ModelStyleLayer, coords: Array<OverscaledTileID>, scope: string) {
    const tr = painter.transform;
    if (tr.projection.name !== 'mercator') {
        warnOnce(`Drawing 3D models for ${tr.projection.name} projection is not yet implemented`);
        return;
    }

    const mercCameraPos = (tr.getFreeCameraOptions().position: any);
    if (!painter.modelManager) return;
    const modelManager = painter.modelManager;
    layer.modelManager = modelManager;
    const shadowRenderer = painter.shadowRenderer;

    if (!layer._unevaluatedLayout._values.hasOwnProperty('model-id')) { return; }

    const modelIdUnevaluatedProperty = layer._unevaluatedLayout._values['model-id'];
    const evaluationParameters = {...layer.layout.get("model-id").parameters};

    for (const coord of coords) {
        const tile = source.getTile(coord);
        const bucket: ?ModelBucket = (tile.getBucket(layer): any);
        if (!bucket || bucket.projection.name !== tr.projection.name) continue;
        const modelUris = bucket.getModelUris();
        if (modelUris && !bucket.modelsRequested) {
            // geojson models are always set in the root scope to avoid model duplication
            modelManager.addModelsFromBucket(modelUris, scope);
            bucket.modelsRequested = true;
        }

        const tileZoom = calculateTileZoom(coord, tr);
        evaluationParameters.zoom = tileZoom;
        const modelIdProperty = modelIdUnevaluatedProperty.possiblyEvaluate(evaluationParameters);
        updateModelBucketData(painter, bucket, coord);

        renderData.shadowUniformsInitialized = false;
        renderData.useSingleShadowCascade = !!shadowRenderer && shadowRenderer.getMaxCascadeForTile(coord.toUnwrapped()) === 0;
        if (painter.renderPass === 'shadow' && shadowRenderer) {
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
        const tiles = 1 << coord.canonical.z;
        const cameraPos = [
            ((mercCameraPos.x - coord.wrap) * tiles - coord.canonical.x) * EXTENT,
            (mercCameraPos.y * tiles - coord.canonical.y) * EXTENT,
            mercCameraPos.z * tiles * EXTENT
        ];

        for (let modelId in bucket.instancesPerModel) {
            // From effective tile zoom (distance to camera) and calculate model to use.
            const modelInstances = bucket.instancesPerModel[modelId];
            if (modelInstances.features.length > 0) {
                modelId = modelIdProperty.evaluate(modelInstances.features[0].feature, {});
            }

            const model = modelManager.getModel(modelId, scope);
            if (!model || !model.uploaded) continue;

            for (const node of model.nodes) {
                drawInstancedNode(painter, layer, node, modelInstances, cameraPos, coord, renderData);
            }
        }
    }
}

const minimumInstanceCount = 20;

function drawInstancedNode(painter: Painter, layer: ModelStyleLayer, node: Node, modelInstances: any, cameraPos: [number, number, number], coord: OverscaledTileID, renderData: RenderData) {
    const context = painter.context;
    const isShadowPass = painter.renderPass === 'shadow';
    const shadowRenderer = painter.shadowRenderer;
    const depthMode = isShadowPass && shadowRenderer ? shadowRenderer.getShadowPassDepthMode() : new DepthMode(context.gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D);
    const affectedByFog = painter.isTileAffectedByFog(coord);

    if (node.meshes) {
        for (const mesh of node.meshes) {
            const definesValues = ['MODEL_POSITION_ON_GPU'];
            const dynamicBuffers = [];
            let program;
            let uniformValues;
            let colorMode;

            if (modelInstances.instancedDataArray.length > minimumInstanceCount) {
                definesValues.push('INSTANCED_ARRAYS');
            }

            const cutoffParams = getCutoffParams(painter, layer.paint.get('model-cutoff-fade-range'));
            if (cutoffParams.shouldRenderCutoff) {
                definesValues.push('RENDER_CUTOFF');
            }
            if (isShadowPass && shadowRenderer) {
                program = painter.getOrCreateProgram('modelDepth', {defines: ((definesValues: any): DynamicDefinesType[])});
                uniformValues = modelDepthUniformValues(renderData.shadowTileMatrix, renderData.shadowTileMatrix, Float32Array.from(node.matrix));
                colorMode = shadowRenderer.getShadowPassColorMode();
            } else {
                setupMeshDraw(definesValues, dynamicBuffers, mesh, painter);
                program = painter.getOrCreateProgram('model', {defines: ((definesValues: any): DynamicDefinesType[]), overrideFog: affectedByFog});
                const material = mesh.material;
                const pbr = material.pbrMetallicRoughness;
                const layerOpacity = layer.paint.get('model-opacity');

                const emissiveStrength = layer.paint.get('model-emissive-strength').constantOr(0.0);

                uniformValues = modelUniformValues(
                    coord.expandedProjMatrix,
                    Float32Array.from(node.matrix),
                    new Float32Array(16),
                    painter,
                    layerOpacity,
                    pbr.baseColorFactor,
                    material.emissiveFactor,
                    pbr.metallicFactor,
                    pbr.roughnessFactor,
                    material,
                    emissiveStrength,
                    layer,
                    cameraPos
                );
                if (shadowRenderer) {
                    if (!renderData.shadowUniformsInitialized) {
                        shadowRenderer.setupShadows(coord.toUnwrapped(), program, 'model-tile', coord.overscaledZ);
                        renderData.shadowUniformsInitialized = true;
                    } else {
                        program.setShadowUniformValues(context, shadowRenderer.getShadowUniformValues());
                    }
                }

                const needsBlending = cutoffParams.shouldRenderCutoff || layerOpacity < 1.0 || material.alphaMode !== 'OPAQUE';
                colorMode = needsBlending ? ColorMode.alphaBlended : ColorMode.unblended;
            }

            painter.uploadCommonUniforms(context, program, coord.toUnwrapped(), null, cutoffParams);

            assert(modelInstances.instancedDataArray.bytesPerElement === 64);
            const cullFaceMode = mesh.material.doubleSided ? CullFaceMode.disabled : CullFaceMode.backCCW;
            if  (modelInstances.instancedDataArray.length > minimumInstanceCount) {
                dynamicBuffers.push(modelInstances.instancedDataBuffer);
                program.draw(painter, context.gl.TRIANGLES, depthMode, StencilMode.disabled, colorMode, cullFaceMode,
                uniformValues, layer.id, mesh.vertexBuffer, mesh.indexBuffer, mesh.segments, layer.paint, painter.transform.zoom,
                undefined, dynamicBuffers, modelInstances.instancedDataArray.length);
            } else {
                const instanceUniform = isShadowPass ? "u_instance" : "u_normal_matrix";
                for (let i = 0; i < modelInstances.instancedDataArray.length; ++i) {
                    /* $FlowIgnore[prop-missing] modelDepth uses u_instance and model uses u_normal_matrix for packing instance data */
                    uniformValues[instanceUniform] = new Float32Array(modelInstances.instancedDataArray.arrayBuffer, i * 64, 16);
                    program.draw(painter, context.gl.TRIANGLES, depthMode, StencilMode.disabled, colorMode, cullFaceMode,
                    uniformValues, layer.id, mesh.vertexBuffer, mesh.indexBuffer, mesh.segments, layer.paint, painter.transform.zoom,
                    undefined, dynamicBuffers);
                }
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
            bucket.elevationUpdate(painter.terrain, exaggeration, coord, layer.source);
        }
        if (bucket.needsReEvaluation(painter, zoom, layer)) {
            bucket.evaluate(layer);
        }
    }
}

function drawBatchedModels(painter: Painter, source: SourceCache, layer: ModelStyleLayer, coords: Array<OverscaledTileID>) {
    layer.resetLayerRenderingStats(painter);
    const context = painter.context;
    const tr = painter.transform;
    const fog = painter.style.fog;
    const shadowRenderer = painter.shadowRenderer;
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
    const layerOpacity = layer.paint.get('model-opacity');

    const depthModeRW = new DepthMode(context.gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D);
    const depthModeRO = new DepthMode(context.gl.LEQUAL, DepthMode.ReadOnly, painter.depthRangeFor3D);

    const aabb = new Aabb([Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]);
    const isShadowPass = painter.renderPass === 'shadow';
    const frustum = isShadowPass && shadowRenderer ? shadowRenderer.getCurrentCascadeFrustum() : tr.getFrustum(tr.scaleZoom(tr.worldSize));

    const stats = layer.getLayerRenderingStats();
    const drawTiles = function(enableColor: boolean, depthWrite: boolean) {
        for (const coord of coords) {
            const tile = source.getTile(coord);
            const bucket: ?Tiled3dModelBucket = (tile.getBucket(layer): any);
            if (!bucket || !bucket.uploaded) continue;

            let singleCascade = false;
            if (shadowRenderer) {
                singleCascade = shadowRenderer.getMaxCascadeForTile(coord.toUnwrapped()) === 0;
            }
            const tileMatrix = tr.calculatePosMatrix(coord.toUnwrapped(), tr.worldSize);
            const modelTraits = bucket.modelTraits;

            for (const nodeInfo of bucket.getNodesInfo()) {
                if (nodeInfo.hiddenByReplacement) continue;
                if (!nodeInfo.node.meshes) continue;

                const scale = nodeInfo.evaluatedScale;
                const node = nodeInfo.node;
                let elevation = 0;
                if (painter.terrain && node.elevation) {
                    elevation = node.elevation * painter.terrain.exaggeration();
                }

                const nodeAabb = () => {
                    const localBounds = nodeInfo.getLocalBounds();
                    aabb.min = [...localBounds.min];
                    aabb.max = [...localBounds.max];
                    aabb.min[2] += elevation;
                    aabb.max[2] += elevation;
                    vec3.transformMat4(aabb.min, aabb.min, tileMatrix);
                    vec3.transformMat4(aabb.max, aabb.max, tileMatrix);
                    return aabb;
                };

                if (scale[0] <= 1 && scale[1] <= 1 && scale[2] <= 1 && nodeAabb().intersects(frustum) === 0) {
                    // While it is possible to use arbitrary scale for landmarks, it is highly unlikely
                    // and frustum culling optimization could be skipped in that case.
                    continue;
                }

                const tileModelMatrix = [...tileMatrix];

                const anchorX = node.anchor ? node.anchor[0] : 0;
                const anchorY = node.anchor ? node.anchor[1] : 0;

                mat4.translate(tileModelMatrix, tileModelMatrix, [anchorX * (scale[0] - 1),
                    anchorY * (scale[1] - 1),
                    elevation]);
                /* $FlowIgnore[incompatible-call] scale should always be an array */
                if (!vec3.exactEquals(scale, DefaultModelScale)) {
                    /* $FlowIgnore[incompatible-call] scale should always be an array */
                    mat4.scale(tileModelMatrix, tileModelMatrix, scale);
                }
                // keep model and nodemodel matrices separate for rendering door lights
                const nodeModelMatrix = mat4.multiply([], tileModelMatrix, node.matrix);

                const lightingMatrix = mat4.multiply([], zScaleMatrix, tileModelMatrix);
                mat4.multiply(lightingMatrix, negCameraPosMatrix, lightingMatrix);
                const normalMatrix = mat4.invert([], lightingMatrix);
                mat4.transpose(normalMatrix, normalMatrix);
                mat4.scale(normalMatrix, normalMatrix, normalScale);

                const isLightBeamPass = painter.renderPass === 'light-beam';
                const wpvForNode = mat4.multiply([], tr.expandedFarZProjMatrix, nodeModelMatrix);
                // Lights come in tilespace so wvp should not include node.matrix when rendering door ligths
                const wpvForTile = mat4.multiply([], tr.expandedFarZProjMatrix, tileModelMatrix);
                const hasMapboxFeatures = modelTraits & ModelTraits.HasMapboxMeshFeatures;
                const emissiveStrength = hasMapboxFeatures ? 0.0 : nodeInfo.evaluatedRMEA[0][2];

                for (let i = 0; i < node.meshes.length; ++i) {
                    const mesh = node.meshes[i];
                    const isLight = i === node.lightMeshIndex;
                    let worldViewProjection = wpvForNode;
                    if (isLight) {
                        if (!isLightBeamPass && !painter.terrain && painter.shadowRenderer) {
                            if (painter.currentLayer < painter.firstLightBeamLayer) {
                                painter.firstLightBeamLayer = painter.currentLayer;
                            }
                            continue;
                        }
                        // Lights come in tilespace
                        worldViewProjection = wpvForTile;
                    } else if (isLightBeamPass) {
                        continue;
                    }

                    const programOptions: CreateProgramParams = {
                        defines: []
                    };
                    const dynamicBuffers = [];
                    setupMeshDraw(((programOptions.defines: any): Array<string>), dynamicBuffers, mesh, painter);
                    if (!hasMapboxFeatures) {
                        (programOptions.defines: any).push('DIFFUSE_SHADED');
                    }

                    if (singleCascade) {
                        (programOptions.defines: any).push('SHADOWS_SINGLE_CASCADE');
                    }

                    if (stats) {
                        if (!isShadowPass) {
                            stats.numRenderedVerticesInTransparentPass += mesh.vertexArray.length;
                        } else {
                            stats.numRenderedVerticesInShadowPass += mesh.vertexArray.length;
                        }
                    }

                    if (isShadowPass) {
                        drawShadowCaster(mesh, nodeModelMatrix, painter, layer);
                        continue;
                    }

                    let fogMatrixArray = null;
                    if (fog) {
                        const fogMatrix = fogMatrixForModel(nodeModelMatrix, painter.transform);
                        fogMatrixArray = new Float32Array(fogMatrix);

                        if (tr.projection.name !== 'globe') {
                            const min = mesh.aabb.min;
                            const max = mesh.aabb.max;
                            const [minOpacity, maxOpacity] = fog.getOpacityForBounds(fogMatrix, min[0], min[1], max[0], max[1]);
                            programOptions.overrideFog = minOpacity >= FOG_OPACITY_THRESHOLD || maxOpacity >= FOG_OPACITY_THRESHOLD;
                        }
                    }

                    const material = mesh.material;
                    let occlusionTextureTransform;
                    // Handle Texture transform
                    if (material.occlusionTexture && material.occlusionTexture.offsetScale) {
                        occlusionTextureTransform = material.occlusionTexture.offsetScale;
                        (programOptions.defines: any).push('OCCLUSION_TEXTURE_TRANSFORM');
                    }

                    if (!isShadowPass && shadowRenderer) {
                        // Set normal offset before program creation, as it adds/remove necessary defines under the hood
                        shadowRenderer.useNormalOffset = !!mesh.normalBuffer;
                    }

                    const program = painter.getOrCreateProgram('model', programOptions);

                    if (!isShadowPass && shadowRenderer) {
                        shadowRenderer.setupShadowsFromMatrix(nodeModelMatrix, program, shadowRenderer.useNormalOffset);
                    }

                    painter.uploadCommonUniforms(context, program, null, fogMatrixArray);

                    const pbr = material.pbrMetallicRoughness;
                    // These values were taken from the tilesets used for testing
                    pbr.metallicFactor = 0.9;
                    pbr.roughnessFactor = 0.5;

                    // Set emissive strength to zero for landmarks, as it is already used embedded in the PBR buffer.
                    const uniformValues = modelUniformValues(
                            new Float32Array(worldViewProjection),
                            new Float32Array(lightingMatrix),
                            new Float32Array(normalMatrix),
                            painter,
                            layerOpacity,
                            pbr.baseColorFactor,
                            material.emissiveFactor,
                            pbr.metallicFactor,
                            pbr.roughnessFactor,
                            material,
                            emissiveStrength,
                            layer,
                            [0, 0, 0],
                            occlusionTextureTransform
                    );

                    const meshNeedsBlending = isLight || layerOpacity < 1.0 || nodeInfo.hasTranslucentParts;
                    const colorMode = enableColor ? (meshNeedsBlending ? ColorMode.alphaBlended : ColorMode.unblended) : ColorMode.disabled;
                    const depthMode = (depthWrite && !isLight) ? depthModeRW : depthModeRO;

                    program.draw(painter, context.gl.TRIANGLES, depthMode, StencilMode.disabled, colorMode, CullFaceMode.backCCW,
                        uniformValues, layer.id, mesh.vertexBuffer, mesh.indexBuffer, mesh.segments, layer.paint, painter.transform.zoom,
                        undefined, dynamicBuffers);
                }
            }
        }
    };

    // Evaluate bucket and prepare for rendering
    prepareBatched(painter, source, layer, coords);

    if (layerOpacity === 1.0) {
        drawTiles(true, true);
    } else {
        // Draw transparent buildings in two passes so that only the closest surface is drawn.
        // First draw all the extrusions into only the depth buffer. No colors are drawn.
        // Then draw all the extrusions a second type, only coloring fragments if they have the
        // same depth value as the closest fragment in the previous pass. Use the stencil buffer
        // to prevent the second draw in cases where we have coincident polygons.
        drawTiles(false, true);
        drawTiles(true, false);
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

