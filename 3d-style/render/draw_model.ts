import {modelUniformValues, modelDepthUniformValues} from './program/model_program';
import {ModelTraits, DefaultModelScale} from '../data/model';
import EXTENT from '../../src/style-spec/data/extent';
import StencilMode from '../../src/gl/stencil_mode';
import ColorMode from '../../src/gl/color_mode';
import DepthMode from '../../src/gl/depth_mode';
import CullFaceMode from '../../src/gl/cull_face_mode';
import {mat4, vec3, vec4} from 'gl-matrix';
import {getMetersPerPixelAtLatitude, mercatorZfromAltitude, tileToMeter} from '../../src/geo/mercator_coordinate';
import TextureSlots from './texture_slots';
import {convertModelMatrixForGlobe} from '../util/model_util';
import {clamp, warnOnce} from '../../src/util/util';
import assert from 'assert';
import {DEMSampler} from '../../src/terrain/elevation';
import {Aabb} from '../../src/util/primitives';
import {getCutoffParams} from '../../src/render/cutoff';
import {FOG_OPACITY_THRESHOLD} from '../../src/style/fog_helpers';
import {ZoomDependentExpression} from '../../src/style-spec/expression/index';
import {Texture3D} from '../../src/render/texture';
import {pointInFootprint} from '../../3d-style/source/replacement_source';
import Point from '@mapbox/point-geometry';

import type Program from '../../src/render/program';
import type Transform from '../../src/geo/transform';
import type ModelBucket from '../data/bucket/model_bucket';
import type {UniformValues} from '../../src/render/uniform_binding';
import type {OverscaledTileID} from '../../src/source/tile_id';
import type {Tiled3dModelFeature} from '../data/bucket/tiled_3d_model_bucket';
import type Tiled3dModelBucket from '../data/bucket/tiled_3d_model_bucket';
import type Painter from '../../src/render/painter';
import type {CreateProgramParams} from '../../src/render/painter';
import type SourceCache from '../../src/source/source_cache';
import type ModelStyleLayer from '../style/style_layer/model_style_layer';
import type {Mesh, ModelNode, ModelTexture} from '../data/model';
import type {DynamicDefinesType} from '../../src/render/program/program_uniforms';
import type VertexBuffer from '../../src/gl/vertex_buffer';
import type {CutoffParams} from '../../src/render/cutoff';
import type {LUT} from "../../src/util/lut";
import type {ModelUniformsType, ModelDepthUniformsType} from '../render/program/model_program';

export default drawModels;

type ModelParameters = {
    zScaleMatrix: mat4;
    negCameraPosMatrix: mat4;
};

type SortedMesh = {
    mesh: Mesh;
    depth: number;
    modelIndex: number;
    worldViewProjection: mat4;
    nodeModelMatrix: mat4;
};

type SortedNode = {
    nodeInfo: Tiled3dModelFeature;
    depth: number;
    opacity: number;
    wvpForNode: mat4;
    wvpForTile: mat4;
    nodeModelMatrix: mat4;
    tileModelMatrix: mat4;
};

type RenderData = {
    shadowUniformsInitialized: boolean;
    useSingleShadowCascade: boolean;
    tileMatrix: Float64Array;
    shadowTileMatrix: Float32Array;
    aabb: Aabb;
};

function fogMatrixForModel(modelMatrix: mat4, transform: Transform): mat4 {
    // convert model matrix from the default world size to the one used by the fog
    const fogMatrix = [...modelMatrix] as mat4;
    const scale = transform.cameraWorldSizeForFog / transform.worldSize;
    const scaleMatrix = mat4.identity([] as unknown as mat4);
    mat4.scale(scaleMatrix, scaleMatrix, [scale, scale, 1]);
    mat4.multiply(fogMatrix, scaleMatrix, fogMatrix);
    mat4.multiply(fogMatrix, transform.worldToFogMatrix, fogMatrix);
    return fogMatrix;
}

// Collect defines and dynamic buffers (colors, normals, uv) and bind textures. Used for single mesh and instanced draw.
function setupMeshDraw(definesValues: Array<string>, dynamicBuffers: Array<VertexBuffer | null | undefined>, mesh: Mesh, painter: Painter, lut: LUT | null) {
    const material = mesh.material;
    const context = painter.context;

    const {baseColorTexture, metallicRoughnessTexture} = material.pbrMetallicRoughness;
    const {normalTexture, occlusionTexture, emissionTexture} = material;

    function setupTexture(texture: ModelTexture | null | undefined, define: string, slot: number) {
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

    if (lut) {
        if (!lut.texture) {
            lut.texture = new Texture3D(painter.context, lut.image, [lut.image.height, lut.image.height, lut.image.height], context.gl.RGBA8);
        }
        context.activeTexture.set(context.gl.TEXTURE0 + TextureSlots.LUT);
        if (lut.texture) {
            lut.texture.bind(context.gl.LINEAR, context.gl.CLAMP_TO_EDGE);
        }
        definesValues.push('APPLY_LUT_ON_GPU');
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

    const shadowRenderer = painter.shadowRenderer;
    if (shadowRenderer) {
        definesValues.push('RENDER_SHADOWS', 'DEPTH_TEXTURE');
        if (shadowRenderer.useNormalOffset) {
            definesValues.push('NORMAL_OFFSET');
        }
    }
}

function drawMesh(sortedMesh: SortedMesh, painter: Painter, layer: ModelStyleLayer, modelParameters: ModelParameters, stencilMode: StencilMode, colorMode: ColorMode) {
    const opacity = layer.paint.get('model-opacity').constantOr(1.0);

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
        lightingMatrix = mat4.multiply([] as unknown as mat4, modelParameters.zScaleMatrix, sortedMesh.nodeModelMatrix);
    }
    mat4.multiply(lightingMatrix, modelParameters.negCameraPosMatrix, lightingMatrix);
    const normalMatrix = mat4.invert([] as unknown as mat4, lightingMatrix);
    mat4.transpose(normalMatrix, normalMatrix);

    const ignoreLut = layer.paint.get('model-color-use-theme').constantOr('default') === 'none';
    const emissiveStrength = layer.paint.get('model-emissive-strength').constantOr(0.0);
    const uniformValues = modelUniformValues(
        new Float32Array(sortedMesh.worldViewProjection),
        new Float32Array(lightingMatrix),
        new Float32Array(normalMatrix),
        null,
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

    const shadowRenderer = painter.shadowRenderer;
    if (shadowRenderer) { shadowRenderer.useNormalOffset = false; }

    setupMeshDraw((programOptions.defines as Array<string>), dynamicBuffers, mesh, painter, ignoreLut ? null : layer.lut);

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
        programOptions.defines.push('RENDER_CUTOFF');
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

    if (modelSource.type !== 'model') return;

    const models = modelSource.getModels();
    // Upload models
    for (const model of models) {
        model.upload(painter.context);
    }
}

function prepareMeshes(transform: Transform, node: ModelNode, modelMatrix: mat4, projectionMatrix: mat4, modelIndex: number, transparentMeshes: Array<SortedMesh>,  opaqueMeshes: Array<SortedMesh>) {

    let nodeModelMatrix;
    if (transform.projection.name === 'globe') {
        nodeModelMatrix = convertModelMatrixForGlobe(modelMatrix, transform);
    } else {
        nodeModelMatrix = [...modelMatrix];
    }
    mat4.multiply(nodeModelMatrix, nodeModelMatrix, node.matrix);
    const worldViewProjection = mat4.multiply([] as unknown as mat4, projectionMatrix, nodeModelMatrix);
    if (node.meshes) {
        for (const mesh of node.meshes) {
            if (mesh.material.alphaMode !== 'BLEND') {
                const opaqueMesh: SortedMesh = {mesh, depth: 0.0, modelIndex, worldViewProjection, nodeModelMatrix};
                opaqueMeshes.push(opaqueMesh);
                continue;
            }

            const centroidPos = vec3.transformMat4([] as unknown as vec3, mesh.centroid, worldViewProjection);
            // Filter meshes behind the camera if in perspective mode
            if (!transform.isOrthographic && centroidPos[2] <= 0.0) continue;
            const transparentMesh: SortedMesh = {mesh, depth: centroidPos[2], modelIndex, worldViewProjection, nodeModelMatrix};
            transparentMeshes.push(transparentMesh);
        }
    }
    if (node.children) {
        for (const child of node.children) {
            prepareMeshes(transform, child, modelMatrix, projectionMatrix, modelIndex, transparentMeshes, opaqueMeshes);
        }
    }
}

function drawShadowCaster(mesh: Mesh, matrix: mat4, painter: Painter, layer: ModelStyleLayer) {
    const shadowRenderer = painter.shadowRenderer;
    if (!shadowRenderer) return;
    const depthMode = shadowRenderer.getShadowPassDepthMode();
    const colorMode = shadowRenderer.getShadowPassColorMode();
    const shadowMatrix = shadowRenderer.calculateShadowPassMatrixFromMatrix(matrix);
    const uniformValues = modelDepthUniformValues(shadowMatrix);
    const definesValues = (painter._shadowMapDebug) ? [] : ['DEPTH_TEXTURE'];
    const program = painter.getOrCreateProgram('modelDepth', {defines: (definesValues as DynamicDefinesType[])});
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
    const opacity = layer.paint.get('model-opacity').constantOr(1.0);
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

    if (modelSource.type !== 'model') return;

    const models = modelSource.getModels();
    const modelParametersVector: ModelParameters[] = [];

    const mercCameraPos = painter.transform.getFreeCameraOptions().position;
    const cameraPos = vec3.scale([] as unknown as vec3, [mercCameraPos.x, mercCameraPos.y, mercCameraPos.z], painter.transform.worldSize);
    vec3.negate(cameraPos, cameraPos);
    const transparentMeshes: SortedMesh[] = [];
    const opaqueMeshes: SortedMesh[] = [];
    let modelIndex = 0;
    // Draw models
    for (const model of models) {

        const rotation = layer.paint.get('model-rotation').constantOr(null);

        const scale = layer.paint.get('model-scale').constantOr(null);

        const translation = layer.paint.get('model-translation').constantOr(null);
        // update model matrices
        model.computeModelMatrix(painter, rotation, scale, translation, true, true, false);

        // compute model parameters matrices
        const negCameraPosMatrix = mat4.identity([] as unknown as mat4);
        const modelMetersPerPixel = getMetersPerPixelAtLatitude(model.position.lat, painter.transform.zoom);
        const modelPixelsPerMeter = 1.0 / modelMetersPerPixel;
        const zScaleMatrix = mat4.fromScaling([] as unknown as mat4, [1.0, 1.0, modelPixelsPerMeter]);
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
    let dem: DEMSampler | null | undefined;
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

    let elevationMin: number | null | undefined;
    let elevationMax: number | null | undefined;

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
    const cameraPos = tr.getFreeCameraOptions().position;
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

    const mercCameraPos = tr.getFreeCameraOptions().position;
    if (!painter.modelManager) return;
    const modelManager = painter.modelManager;
    layer.modelManager = modelManager;
    const shadowRenderer = painter.shadowRenderer;

    if (!layer._unevaluatedLayout._values.hasOwnProperty('model-id')) { return; }

    const modelIdUnevaluatedProperty = layer._unevaluatedLayout._values['model-id'];

    const evaluationParameters = Object.assign({}, layer.layout.get("model-id").parameters);

    const layerIndex = painter.style.order.indexOf(layer.fqid);

    for (const coord of coords) {
        const tile = source.getTile(coord);
        const bucket = tile.getBucket(layer) as ModelBucket | null | undefined;
        if (!bucket || bucket.projection.name !== tr.projection.name) continue;
        const modelUris = bucket.getModelUris();
        if (modelUris && !bucket.modelsRequested) {
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
            renderData.aabb.min = [0, 0, 0];
            renderData.aabb.max[0] = renderData.aabb.max[1] = EXTENT;
            renderData.aabb.max[2] = 0;
            if (calculateTileShadowPassCulling(bucket, renderData, painter, layer.scope)) continue;
        }

        // camera position in the tile coordinates
        const tiles = 1 << coord.canonical.z;
        const cameraPos: [number, number, number] = [
            ((mercCameraPos.x - coord.wrap) * tiles - coord.canonical.x) * EXTENT,
            (mercCameraPos.y * tiles - coord.canonical.y) * EXTENT,
            mercCameraPos.z * tiles * EXTENT
        ];

        const clippable = painter.conflationActive && Object.keys(bucket.instancesPerModel).length > 0 && painter.style.isLayerClipped(layer, source.getSource());
        if (clippable) {
            if (bucket.updateReplacement(coord, painter.replacementSource, layerIndex, scope)) {
                bucket.uploaded = false;
                bucket.upload(painter.context);
            }
        }

        for (let modelId in bucket.instancesPerModel) {
            // From effective tile zoom (distance to camera) and calculate model to use.
            const modelInstances = bucket.instancesPerModel[modelId];
            if (modelInstances.features.length > 0) {
                // @ts-expect-error - TS2339 - Property 'evaluate' does not exist on type 'unknown'.
                modelId = modelIdProperty.evaluate(modelInstances.features[0].feature, {});
            }

            const model = modelManager.getModel(modelId, scope);
            if (!model && !modelManager.hasURLBeenRequested(modelId) && !bucket.modelUris.includes(modelId)) {
                // We are asking for a model that's not yet on this bucket's model list
                bucket.modelUris.push(modelId);
                bucket.modelsRequested = false;
            }
            if (!model || !model.uploaded) continue;

            for (const node of model.nodes) {
                drawInstancedNode(painter, layer, node, modelInstances, cameraPos, coord, renderData);
            }
        }
    }
}

const minimumInstanceCount = 20;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawInstancedNode(painter: Painter, layer: ModelStyleLayer, node: ModelNode, modelInstances: any, cameraPos: [number, number, number], coord: OverscaledTileID, renderData: RenderData) {
    const context = painter.context;
    const isShadowPass = painter.renderPass === 'shadow';
    const shadowRenderer = painter.shadowRenderer;
    const depthMode = isShadowPass && shadowRenderer ? shadowRenderer.getShadowPassDepthMode() : new DepthMode(context.gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D);
    const affectedByFog = painter.isTileAffectedByFog(coord);

    if (node.meshes) {
        for (const mesh of node.meshes) {
            const definesValues = ['MODEL_POSITION_ON_GPU'];
            const dynamicBuffers = [];
            let program: Program<ModelUniformsType | ModelDepthUniformsType>;
            let uniformValues: UniformValues<ModelUniformsType | ModelDepthUniformsType>;
            let colorMode;

            if (modelInstances.instancedDataArray.length > minimumInstanceCount) {
                definesValues.push('INSTANCED_ARRAYS');
            }

            const cutoffParams = getCutoffParams(painter, layer.paint.get('model-cutoff-fade-range'));
            if (cutoffParams.shouldRenderCutoff) {
                definesValues.push('RENDER_CUTOFF');
            }
            if (isShadowPass && shadowRenderer) {
                program = painter.getOrCreateProgram('modelDepth', {defines: (definesValues as DynamicDefinesType[])});
                uniformValues = modelDepthUniformValues(renderData.shadowTileMatrix, renderData.shadowTileMatrix, Float32Array.from(node.matrix));
                colorMode = shadowRenderer.getShadowPassColorMode();
            } else {

                const ignoreLut = layer.paint.get('model-color-use-theme').constantOr('default') === 'none';
                setupMeshDraw(definesValues, dynamicBuffers, mesh, painter, ignoreLut ? null : layer.lut);
                program = painter.getOrCreateProgram('model', {defines: (definesValues as DynamicDefinesType[]), overrideFog: affectedByFog});
                const material = mesh.material;
                const pbr = material.pbrMetallicRoughness;
                const layerOpacity = layer.paint.get('model-opacity').constantOr(1.0);

                const emissiveStrength = layer.paint.get('model-emissive-strength').constantOr(0.0);
                uniformValues = modelUniformValues(
                    coord.expandedProjMatrix,
                    Float32Array.from(node.matrix),
                    new Float32Array(16),
                    null,
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
                        shadowRenderer.setupShadows(coord.toUnwrapped(), program, 'model-tile');
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
        const bucket = tile.getBucket(layer) as Tiled3dModelBucket | null | undefined;
        if (!bucket) continue;
        bucket.setFilter(layer.filter);
        // Conflation
        if (painter.conflationActive) bucket.updateReplacement(coord, painter.replacementSource);
        bucket.evaluateTransform(painter, layer);
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

    const mercCameraPos = painter.transform.getFreeCameraOptions().position;
    const cameraPos = vec3.scale([] as unknown as vec3, [mercCameraPos.x, mercCameraPos.y, mercCameraPos.z], painter.transform.worldSize);
    const negCameraPos = vec3.negate([] as unknown as vec3, cameraPos);
    // compute model parameters matrices
    const negCameraPosMatrix = mat4.identity([] as unknown as mat4);
    const metersPerPixel = getMetersPerPixelAtLatitude(tr.center.lat, tr.zoom);
    const pixelsPerMeter = 1.0 / metersPerPixel;
    const zScaleMatrix = mat4.fromScaling([] as unknown as mat4, [1.0, 1.0, pixelsPerMeter]);
    mat4.translate(negCameraPosMatrix, negCameraPosMatrix, negCameraPos);
    const layerOpacity = layer.paint.get('model-opacity').constantOr(1.0);

    const depthModeRW = new DepthMode(context.gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D);
    const depthModeRO = new DepthMode(context.gl.LEQUAL, DepthMode.ReadOnly, painter.depthRangeFor3D);

    const aabb = new Aabb([Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]);
    const isShadowPass = painter.renderPass === 'shadow';
    const frustum = isShadowPass && shadowRenderer ? shadowRenderer.getCurrentCascadeFrustum() : tr.getFrustum(tr.scaleZoom(tr.worldSize));

    const frontCutoffParams = layer.paint.get('model-front-cutoff');
    const frontCutoffEnabled = frontCutoffParams[2] < 1.0;

    const cutoffParams = getCutoffParams(painter, layer.paint.get('model-cutoff-fade-range'));

    const stats = layer.getLayerRenderingStats();
    const drawTiles = function () {
        let start, end, step;
        // When front cutoff is enabled the tiles are iterated in back to front order
        if (frontCutoffEnabled) {
            start = coords.length - 1;
            end = -1;
            step = -1;
        } else {
            start = 0;
            end = coords.length;
            step = 1;
        }

        const invTileMatrix = new Float64Array(16) as unknown as mat4;
        const cameraPosTileCoord = vec3.create();
        const cameraPointTileCoord = new Point(0.0, 0.0);

        for (let i = start; i !== end; i += step) {
            const coord = coords[i];
            const tile = source.getTile(coord);
            const bucket = tile.getBucket(layer) as Tiled3dModelBucket | null | undefined;
            if (!bucket || !bucket.uploaded) continue;

            let singleCascade = false;
            if (shadowRenderer) {
                singleCascade = shadowRenderer.getMaxCascadeForTile(coord.toUnwrapped()) === 0;
            }
            const tileMatrix = tr.calculatePosMatrix(coord.toUnwrapped(), tr.worldSize);
            const modelTraits = bucket.modelTraits;

            if (!isShadowPass && frontCutoffEnabled) {
                mat4.invert(invTileMatrix, tileMatrix);
                vec3.transformMat4(cameraPosTileCoord, cameraPos, invTileMatrix);
                cameraPointTileCoord.x = cameraPosTileCoord[0];
                cameraPointTileCoord.y = cameraPosTileCoord[1];
            }

            const sortedNodes: Array<SortedNode> = [];
            bucket.setFilter(layer.filter);
            for (const nodeInfo of bucket.getNodesInfo()) {
                if (nodeInfo.hiddenByReplacement) continue;
                if (!nodeInfo.node.meshes) continue;

                const node = nodeInfo.node;
                let elevation = 0;
                if (painter.terrain && node.elevation) {
                    elevation = node.elevation * painter.terrain.exaggeration();
                }

                const calculateNodeAabb = () => {
                    const localBounds = nodeInfo.aabb;
                    aabb.min = [...localBounds.min] as vec3;
                    aabb.max = [...localBounds.max] as vec3;
                    aabb.min[2] += elevation;
                    aabb.max[2] += elevation;
                    vec3.transformMat4(aabb.min, aabb.min, tileMatrix);
                    vec3.transformMat4(aabb.max, aabb.max, tileMatrix);
                    return aabb;
                };
                const nodeAabb = calculateNodeAabb();

                const scale = nodeInfo.evaluatedScale;
                if (scale[0] <= 1 && scale[1] <= 1 && scale[2] <= 1 && nodeAabb.intersects(frustum) === 0) {
                    // While it is possible to use arbitrary scale for landmarks, it is highly unlikely
                    // and frustum culling optimization could be skipped in that case.
                    continue;
                }

                if (!isShadowPass && frontCutoffEnabled) {
                    const opacityChangePerFrame = 1.0 / 6.0; // this is not driving animation evaluation, but is updated on change
                    if (cameraPos[0] > nodeAabb.min[0] && cameraPos[0] < nodeAabb.max[0] &&
                        cameraPos[1] > nodeAabb.min[1] && cameraPos[1] < nodeAabb.max[1] &&
                        cameraPos[2] * metersPerPixel < nodeAabb.max[2] &&
                        node.footprint && pointInFootprint(cameraPointTileCoord, node.footprint)) {
                        nodeInfo.cameraCollisionOpacity = Math.max(nodeInfo.cameraCollisionOpacity - opacityChangePerFrame, 0.0);
                    } else {
                        nodeInfo.cameraCollisionOpacity = Math.min(1.0, nodeInfo.cameraCollisionOpacity + opacityChangePerFrame);
                    }
                }

                const tileModelMatrix = [...tileMatrix] as mat4;
                const tileUnitsPerMeter = 1.0 / tileToMeter(coord.canonical);

                const anchorX = node.anchor ? node.anchor[0] : 0;
                const anchorY = node.anchor ? node.anchor[1] : 0;

                mat4.translate(tileModelMatrix, tileModelMatrix, [
                    anchorX * (scale[0] - 1) + nodeInfo.evaluatedTranslation[0] * tileUnitsPerMeter,
                    anchorY * (scale[1] - 1) + nodeInfo.evaluatedTranslation[1] * tileUnitsPerMeter,
                    elevation + nodeInfo.evaluatedTranslation[2]]);
                if (!vec3.exactEquals(scale, DefaultModelScale)) {
                    mat4.scale(tileModelMatrix, tileModelMatrix, scale);
                }

                // keep model and nodemodel matrices separate for rendering door lights
                const nodeModelMatrix = mat4.multiply([] as unknown as mat4, tileModelMatrix, node.matrix);
                const wvpForNode = mat4.multiply([] as unknown as mat4, tr.expandedFarZProjMatrix, nodeModelMatrix);
                // Lights come in tilespace so wvp should not include node.matrix when rendering door ligths
                const wvpForTile = mat4.multiply([] as unknown as mat4, tr.expandedFarZProjMatrix, tileModelMatrix);
                const anchorPos = vec4.transformMat4([] as unknown as vec4, [anchorX, anchorY, elevation, 1.0], wvpForNode);
                const depth = anchorPos[2];

                node.hidden = false;
                let opacity = layerOpacity;
                if (!isShadowPass) {
                    if (frontCutoffEnabled) {
                        opacity *= nodeInfo.cameraCollisionOpacity;
                        opacity *= calculateFrontCutoffOpacity(tileModelMatrix, tr, nodeInfo.aabb, frontCutoffParams);
                    }

                    opacity *= calculateFarCutoffOpacity(cutoffParams, depth);
                }
                if (opacity === 0.0) {
                    node.hidden = true;
                    continue;
                }

                const sortedNode: SortedNode = {
                    nodeInfo,
                    depth,

                    opacity,
                    wvpForNode,
                    wvpForTile,
                    nodeModelMatrix,
                    tileModelMatrix
                };

                sortedNodes.push(sortedNode);
            }

            if (!isShadowPass) {
                // Sort nodes. Opaque nodes first in front to back order. Then non-opaque nodes in back to front order.
                sortedNodes.sort((a, b) => {
                    // Front to back order for opaque nodes, and for all nodes when front cutoff is disabled
                    if (!frontCutoffEnabled || (a.opacity === 1.0 && b.opacity === 1.0)) {
                        return a.depth < b.depth ? -1 : 1;
                    }
                    if (a.opacity === 1.0) {
                        return -1;
                    }
                    if (b.opacity === 1.0) {
                        return 1;
                    }

                    // Back to front order for non-opaque nodes
                    return a.depth > b.depth ? -1 : 1;
                });
            }

            for (const sortedNode of sortedNodes) {
                const nodeInfo = sortedNode.nodeInfo;
                const node = nodeInfo.node;

                let lightingMatrix = mat4.multiply([] as unknown as mat4, zScaleMatrix, sortedNode.tileModelMatrix);
                mat4.multiply(lightingMatrix, negCameraPosMatrix, lightingMatrix);
                const normalMatrix = mat4.invert([] as unknown as mat4, lightingMatrix);
                mat4.transpose(normalMatrix, normalMatrix);
                mat4.scale(normalMatrix, normalMatrix, normalScale as [number, number, number]);

                // lighting matrix should take node.matrix into account
                lightingMatrix = mat4.multiply(lightingMatrix, lightingMatrix, node.matrix);

                const isLightBeamPass = painter.renderPass === 'light-beam';
                const ignoreLut = layer.paint.get('model-color-use-theme').constantOr('default') === 'none';
                const hasMapboxFeatures = modelTraits & ModelTraits.HasMapboxMeshFeatures;
                const emissiveStrength = hasMapboxFeatures ? 0.0 : nodeInfo.evaluatedRMEA[0][2];

                for (let i = 0; i < node.meshes.length; ++i) {
                    const mesh = node.meshes[i];
                    const isLight = i === node.lightMeshIndex;
                    let worldViewProjection = sortedNode.wvpForNode;
                    if (isLight) {
                        if (!isLightBeamPass && !painter.terrain && painter.shadowRenderer) {
                            if (painter.currentLayer < painter.firstLightBeamLayer) {
                                painter.firstLightBeamLayer = painter.currentLayer;
                            }
                            continue;
                        }
                        // Lights come in tilespace
                        worldViewProjection = sortedNode.wvpForTile;
                    } else if (isLightBeamPass) {
                        continue;
                    }

                    const programOptions: CreateProgramParams = {
                        defines: []
                    };
                    const dynamicBuffers = [];

                    if (!isShadowPass && shadowRenderer) {
                        shadowRenderer.useNormalOffset = !!mesh.normalBuffer;
                    }

                    setupMeshDraw((programOptions.defines as Array<string>), dynamicBuffers, mesh, painter, ignoreLut ? null : layer.lut);
                    if (!hasMapboxFeatures) {
                        programOptions.defines.push('DIFFUSE_SHADED');
                    }

                    if (singleCascade) {
                        programOptions.defines.push('SHADOWS_SINGLE_CASCADE');
                    }

                    if (stats) {
                        if (!isShadowPass) {
                            stats.numRenderedVerticesInTransparentPass += mesh.vertexArray.length;
                        } else {
                            stats.numRenderedVerticesInShadowPass += mesh.vertexArray.length;
                        }
                    }

                    if (isShadowPass) {
                        drawShadowCaster(mesh, sortedNode.nodeModelMatrix, painter, layer);
                        continue;
                    }

                    let fogMatrixArray = null;
                    if (fog) {
                        const fogMatrix = fogMatrixForModel(sortedNode.nodeModelMatrix, painter.transform);
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
                        programOptions.defines.push('OCCLUSION_TEXTURE_TRANSFORM');
                    }

                    const program = painter.getOrCreateProgram('model', programOptions);

                    if (!isShadowPass && shadowRenderer) {
                        // The shadow matrix does not need to include node transforms,
                        // as shadow_pos will be performing that transform in the shader
                        shadowRenderer.setupShadowsFromMatrix(sortedNode.tileModelMatrix, program, shadowRenderer.useNormalOffset);
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
                            new Float32Array(node.matrix),
                            painter,
                            sortedNode.opacity,
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

                    if (!isLight && (nodeInfo.hasTranslucentParts || sortedNode.opacity < 1.0)) {

                        program.draw(painter, context.gl.TRIANGLES, depthModeRW, StencilMode.disabled, ColorMode.disabled, CullFaceMode.backCCW,
                            uniformValues, layer.id, mesh.vertexBuffer, mesh.indexBuffer, mesh.segments, layer.paint, painter.transform.zoom,
                            undefined, dynamicBuffers);
                    }

                    const meshNeedsBlending = isLight || sortedNode.opacity < 1.0 || nodeInfo.hasTranslucentParts;
                    const colorMode = meshNeedsBlending ? ColorMode.alphaBlended : ColorMode.unblended;
                    const depthMode = !isLight ? depthModeRW : depthModeRO;
                    program.draw(painter, context.gl.TRIANGLES, depthMode, StencilMode.disabled, colorMode, CullFaceMode.backCCW,
                        uniformValues, layer.id, mesh.vertexBuffer, mesh.indexBuffer, mesh.segments, layer.paint, painter.transform.zoom,
                        undefined, dynamicBuffers);
                }
            }
        }
    };

    // Evaluate bucket and prepare for rendering
    prepareBatched(painter, source, layer, coords);

    drawTiles();
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

    vec3.transformMat4(aabb.min, aabb.min, renderData.tileMatrix as unknown as mat4);
    vec3.transformMat4(aabb.max, aabb.max, renderData.tileMatrix as unknown as mat4);
    const intersection = aabb.intersects(shadowRenderer.getCurrentCascadeFrustum());
    if (painter.currentShadowCascade === 0) {
        bucket.isInsideFirstShadowMapFrustum = intersection === 2;
    }
    return intersection === 0;
}

function calculateFarCutoffOpacity(cutoffParams: CutoffParams, depth: number): number {
    assert(cutoffParams.uniformValues.u_cutoff_params.length === 4);
    const near = cutoffParams.uniformValues.u_cutoff_params[0];
    const far = cutoffParams.uniformValues.u_cutoff_params[1];
    const cutoffStart = cutoffParams.uniformValues.u_cutoff_params[2];
    const cutoffEnd = cutoffParams.uniformValues.u_cutoff_params[3];

    if (far === near || cutoffEnd === cutoffStart) {
        return 1.0;
    }

    const linearDepth = (depth - near) / (far - near);
    return clamp((linearDepth - cutoffStart) / (cutoffEnd - cutoffStart), 0.0, 1.0);
}

function calculateFrontCutoffOpacity(tileModelMatrix: mat4, tr: Transform, aabb: Aabb, cutoffParams: [number, number, number]) {
    // The cutoff opacity is completely disabled when pitch is lower than 20.
    const fullyOpaquePitch = 20.0;
    const fullyTransparentPitch = 40.0;
    // @ts-expect-error - TS2367 - This comparison appears to be unintentional because the types '20' and '40' have no overlap.
    assert(fullyOpaquePitch !== fullyTransparentPitch);
    if (tr.pitch < fullyOpaquePitch) {
        return 1.0;
    }

    const mat = tr.getWorldToCameraMatrix();
    mat4.multiply(mat, mat, tileModelMatrix);

    // The cutoff opacity is calculated based on how much below the view the AABB bottom corners are.
    // For this, we find the AABB points with the highest and lowest y value in the view space.
    const p = vec4.fromValues(aabb.min[0], aabb.min[1], aabb.min[2], 1.0);
    let r = vec4.transformMat4(vec4.create(), p, mat);
    let pMin = r;
    let pMax = r;
    p[1] = aabb.max[1];
    r = vec4.transformMat4(vec4.create(), p, mat);
    pMin = r[1] < pMin[1] ? r : pMin;
    pMax = r[1] > pMax[1] ? r : pMax;
    p[0] = aabb.max[0];
    r = vec4.transformMat4(vec4.create(), p, mat);
    pMin = r[1] < pMin[1] ? r : pMin;
    pMax = r[1] > pMax[1] ? r : pMax;
    p[1] = aabb.min[1];
    r = vec4.transformMat4(vec4.create(), p, mat);
    pMin = r[1] < pMin[1] ? r : pMin;
    pMax = r[1] > pMax[1] ? r : pMax;

    const cutoffStartParam = clamp(cutoffParams[0], 0.0, 1.0);
    // 100.0 is used here just because it provides a nice looking maximum value for the fade effect.
    // This value could be increased to allow longer fade ranges.
    const cutoffRangeParam = 100.0 * tr.pixelsPerMeter * clamp(cutoffParams[1], 0.0, 1.0);
    const finalOpacity = clamp(cutoffParams[2], 0.0, 1.0);
    const cutoffStart = vec4.lerp(vec4.create(), pMin, pMax, cutoffStartParam);

    const fovScale = Math.tan(tr.fovX * 0.5);
    // Lowest y coordinate that's still visible at the depth of the cutoff start point.
    const yMinLimit = -cutoffStart[2] * fovScale;
    if (cutoffRangeParam === 0.0) {
        return (cutoffStart[1] < -Math.abs(yMinLimit)) ? finalOpacity : 1.0;
    }

    const cutoffFactor = (-Math.abs(yMinLimit) - cutoffStart[1]) / cutoffRangeParam;
    const lerp = (a: number, b: number, t: number) => { return (1 - t) * a + t * b; };
    const opacity = clamp(lerp(1.0, finalOpacity, cutoffFactor), finalOpacity, 1.0);

    return lerp(1.0, opacity, clamp((tr.pitch - fullyOpaquePitch) / (fullyTransparentPitch - fullyOpaquePitch), 0.0, 1.0));
}
