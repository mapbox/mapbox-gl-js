// @flow

import {register} from '../../../src/util/web_worker_transfer.js';
import type {Bucket} from '../../../src/data/bucket.js';
import type {Node} from '../model.js';
import {uploadNode, destroyNodeArrays, destroyBuffers, ModelTraits, HEIGHTMAP_DIM} from '../model.js';
import type {EvaluationFeature} from '../../../src/data/evaluation_feature.js';
import {OverscaledTileID} from '../../../src/source/tile_id.js';
import type {CanonicalTileID} from '../../../src/source/tile_id.js';
import ModelStyleLayer from '../../style/style_layer/model_style_layer.js';
import type Context from '../../../src/gl/context.js';
import type {ProjectionSpecification} from '../../../src/style-spec/types.js';
import type Painter from '../../../src/render/painter.js';
import type {Vec4} from 'gl-matrix';
import {ReplacementSource} from '../../source/replacement_source.js';
import {FeatureVertexArray} from '../../../src/data/array_types.js';
import {number as interpolate} from '../../../src/style-spec/util/interpolate.js';
import {clamp} from '../../../src/util/util.js';
import {DEMSampler} from '../../../src/terrain/elevation.js';
import type {Terrain} from '../../../src/terrain/terrain.js';
import {ZoomConstantExpression} from '../../../src/style-spec/expression/index.js';
import assert from 'assert';
import Point from '@mapbox/point-geometry';

function getNodeHeight(node: Node): number {
    let height = 0;
    if (node.meshes) {
        for (const mesh of node.meshes) {
            height = Math.max(height, mesh.aabb.max[2]);
        }
    }
    if (node.children) {
        for (const child of node.children) {
            height = Math.max(height, getNodeHeight(child));
        }
    }
    return height;
}

export const PartIndices = {
    wall: 1,
    door: 2,
    roof: 3,
    window: 4,
    lamp: 5,
    logo: 6
};

export const PartNames = ['', 'wall', 'door', 'roof', 'window', 'lamp', 'logo'];

export class Tiled3dModelFeature {
    feature: EvaluationFeature;
    evaluatedColor: Array<Vec4>;
    evaluatedRMEA: Array<Vec4>;
    evaluatedScale: [number, number, number];
    hiddenByReplacement: boolean;
    hasTranslucentParts: boolean;
    node: Node;
    emissionHeightBasedParams: Array<[number, number, number, number, number]>;
    constructor(node: Node) {
        this.node = node;
        this.evaluatedRMEA = [[1, 0, 0, 1],
            [1, 0, 0, 1],   // wall
            [1, 0, 0, 1],   // door
            [1, 0, 0, 1],   // roof
            [0.4, 1, 0, 1], // window
            [1, 0, 0, 1],   // lamp
            [1, 0, 0, 1]];  // logo
        this.hiddenByReplacement = false;
        this.evaluatedScale = [1, 1, 1];
        this.evaluatedColor = [];
        this.emissionHeightBasedParams = [];
        // Needs to calculate geometry
        this.feature = {type: 'Point', id: node.id, geometry: [], properties: {'height' : getNodeHeight(node)}};
    }
}

class Tiled3dModelBucket implements Bucket {
    nodes: Array<Node>;
    id: OverscaledTileID;
    uploaded: boolean;
    modelTraits: number;
    hasPattern: boolean;
    layers: Array<ModelStyleLayer>;
    layerIds: Array<string>;
    stateDependentLayers: Array<ModelStyleLayer>;
    stateDependentLayerIds: Array<string>;
    nodesInfo: Array<Tiled3dModelFeature>;
    zoom: number;
    projection: ProjectionSpecification;
    terrainTile: ?CanonicalTileID;
    terrainExaggeration: ?number;
    replacementUpdateTime: number;
    elevationReadFromZ: number;
    dirty: boolean;
    brightness: ?number;
    needsUpload: boolean;
    /* $FlowIgnore[incompatible-type-arg] Doesn't need to know about all the implementations */
    constructor(nodes: Array<Node>, id: OverscaledTileID, hasMbxMeshFeatures: boolean, brightness: ?number) {
        this.nodes = nodes;
        this.id = id;
        this.modelTraits |= ModelTraits.CoordinateSpaceTile;
        this.uploaded = false;
        this.hasPattern = false;
        if (hasMbxMeshFeatures) {
            this.modelTraits |= ModelTraits.HasMapboxMeshFeatures;
        }
        this.zoom = -1;
        this.terrainExaggeration = 1;
        this.projection = {name: 'mercator'};
        this.replacementUpdateTime = 0;
        this.elevationReadFromZ = 0xff; // Re-read if underlying DEM zoom changes.
        this.brightness = brightness;
        this.dirty = true;
        this.needsUpload = false;
    }
    update() {
        console.log("Update 3D model bucket");
    }
    populate() {
        console.log("populate 3D model bucket");
    }
    uploadPending(): boolean {
        return !this.uploaded || this.needsUpload;
    }

    upload(context: Context) {
        if (!this.needsUpload) return;
        const nodesInfo = this.getNodesInfo();
        for (const nodeInfo of nodesInfo) {
            const node = nodeInfo.node;
            if (this.uploaded) {
                this.updatePbrBuffer(node);
                continue;
            }
            uploadNode(node, context, true);
        }
        // Now destroy all buffers
        for (const nodeInfo of nodesInfo) {
            destroyNodeArrays(nodeInfo.node);
        }
        this.uploaded = true;
        this.needsUpload = false;
    }

    updatePbrBuffer(node: Node): boolean {
        let result = false;
        if (!node.meshes) return result;
        for (const mesh of node.meshes) {
            if (mesh.pbrBuffer) {
                mesh.pbrBuffer.updateData(mesh.featureArray);
                result = true;
            }
        }
        return result;
    }

    needsReEvaluation(painter: Painter, zoom: number, layer: ModelStyleLayer): boolean {
        const projection = painter.transform.projectionOptions;
        const calculatedBrightness = painter.style.getBrightness();
        const brightnessChanged = this.brightness !== calculatedBrightness;
        if (!this.uploaded || this.dirty || projection.name !== this.projection.name ||
            expressionRequiresReevaluation(layer.paint.get('model-color').value, brightnessChanged) ||
            expressionRequiresReevaluation(layer.paint.get('model-color-mix-intensity').value, brightnessChanged) ||
            expressionRequiresReevaluation(layer.paint.get('model-roughness').value, brightnessChanged) ||
            expressionRequiresReevaluation(layer.paint.get('model-emissive-strength').value, brightnessChanged) ||
            expressionRequiresReevaluation(layer.paint.get('model-height-based-emissive-strength-multiplier').value, brightnessChanged)) {
            this.dirty = false;
            this.projection = projection;
            this.brightness = calculatedBrightness;
            return true;
        }
        return false;
    }

    evaluateScale(painter: Painter, layer: ModelStyleLayer) {
        if (painter.transform.zoom === this.zoom) return;
        this.zoom = painter.transform.zoom;
        const nodesInfo = this.getNodesInfo();
        const canonical = this.id.canonical;
        for (const nodeInfo of nodesInfo) {
            const evaluationFeature = nodeInfo.feature;
            nodeInfo.evaluatedScale = (layer.paint.get('model-scale').evaluate(evaluationFeature, {}, canonical): any);
        }
    }

    evaluate(layer: ModelStyleLayer) {
        const nodesInfo = this.getNodesInfo();
        for (const nodeInfo of nodesInfo) {
            if (!nodeInfo.node.meshes) continue;
            const evaluationFeature = nodeInfo.feature;
            const hasFeatures = nodeInfo.node.meshes && nodeInfo.node.meshes[0].featureData;
            const previousDoorColor = nodeInfo.evaluatedColor[PartIndices.door];
            const previousDoorRMEA = nodeInfo.evaluatedRMEA[PartIndices.door];
            const canonical = this.id.canonical;
            nodeInfo.hasTranslucentParts = false;

            if (hasFeatures) {
                for (let i = 0; i < PartNames.length; i++) {
                    const part = PartNames[i];
                    if (part.length) {
                        evaluationFeature.properties['part'] = part;
                    }
                    const color = layer.paint.get('model-color').evaluate(evaluationFeature, {}, canonical);
                    const colorMixIntensity = layer.paint.get('model-color-mix-intensity').evaluate(evaluationFeature, {}, canonical);
                    nodeInfo.evaluatedColor[i] = [color.r, color.g, color.b, colorMixIntensity];
                    nodeInfo.evaluatedRMEA[i][0] = layer.paint.get('model-roughness').evaluate(evaluationFeature, {}, canonical);
                    // For the first version metallic is not styled
                    nodeInfo.evaluatedRMEA[i][2] = layer.paint.get('model-emissive-strength').evaluate(evaluationFeature, {}, canonical);
                    nodeInfo.evaluatedRMEA[i][3] = color.a;
                    nodeInfo.emissionHeightBasedParams[i] = layer.paint.get('model-height-based-emissive-strength-multiplier').evaluate(evaluationFeature, {}, canonical);

                    if (!nodeInfo.hasTranslucentParts && color.a < 1.0) {
                        nodeInfo.hasTranslucentParts = true;
                    }
                }
                delete evaluationFeature.properties['part'];
                const doorLightChanged = previousDoorColor !== nodeInfo.evaluatedColor[PartIndices.door] ||
                                         previousDoorRMEA !== nodeInfo.evaluatedRMEA[PartIndices.door];
                updateNodeFeatureVertices(nodeInfo, doorLightChanged);
            }
            nodeInfo.evaluatedScale = (layer.paint.get('model-scale').evaluate(evaluationFeature, {}, canonical): any);
            if (!this.updatePbrBuffer(nodeInfo.node)) {
                this.needsUpload = true;
            }
        }
    }

    elevationUpdate(terrain: Terrain, exaggeration: number, coord: OverscaledTileID) {

        const demTile = terrain.findDEMTileFor(coord);
        if (demTile === this.terrainTile && exaggeration === this.terrainExaggeration) return;

        if (terrain && demTile && demTile.dem && demTile.tileID.overscaledZ !== this.elevationReadFromZ) {
            this.elevationReadFromZ = demTile.tileID.overscaledZ;
            const dem = DEMSampler.create(terrain, this.id, demTile);
            if (!dem) return;
            for (const nodeInfo of this.getNodesInfo()) {
                const node = nodeInfo.node;
                if (!node.footprint || !node.footprint.vertices || !node.footprint.vertices.length) {
                    continue;
                }
                const vertices = node.footprint.vertices;
                let elevation = dem.getElevationAt(vertices[0].x, vertices[0].y, true, true);
                for (let i = 1; i < vertices.length; i++) {
                    elevation = Math.min(elevation, dem.getElevationAt(vertices[i].x, vertices[i].y, true, true));
                }
                node.elevation = elevation;
            }
        }
    }

    getNodesInfo(): Array<Tiled3dModelFeature> {
        if (!this.nodesInfo) {
            this.nodesInfo = [];
            for (const node of this.nodes) {
                this.nodesInfo.push(new Tiled3dModelFeature(node));
            }
            this.freeNodes();
        }
        return this.nodesInfo;
    }

    freeNodes() {
        if (this.nodes) {
            for (const node of this.nodes) {
                destroyBuffers(node);
            }
            this.nodes.splice(0, this.nodes.length);
        }
    }

    destroy() {
        this.freeNodes();
        const nodesInfo = this.getNodesInfo();
        for (const nodeInfo of nodesInfo) {
            destroyNodeArrays(nodeInfo.node);
            destroyBuffers(nodeInfo.node);
        }
    }

    isEmpty(): boolean {
        return !this.nodes.length;
    }

    updateReplacement(coord: OverscaledTileID, source: ReplacementSource) {
        // Replacement has to be re-checked if the source has been updated since last time
        if (source.updateTime === this.replacementUpdateTime) {
            return;
        }

        this.replacementUpdateTime = source.updateTime;
        const activeReplacements = source.getReplacementRegionsForTile(coord.toUnwrapped());
        const nodesInfo = this.getNodesInfo();

        for (let i = 0; i < this.nodesInfo.length; i++) {
            const node = nodesInfo[i].node;

            // Node is visible if its footprint passes the replacement check
            nodesInfo[i].hiddenByReplacement = !!node.footprint && !activeReplacements.find(region => region.footprint === node.footprint);
        }
    }

    getHeightAtTileCoord(x: number, y: number): ?{height: ?number, hidden: boolean, verticalScale: number} {
        const nodesInfo = this.getNodesInfo();
        const candidates = [];

        for (let i = 0; i < this.nodesInfo.length; i++) {
            const nodeInfo = nodesInfo[i];
            assert(nodeInfo.node.meshes.length > 0);
            const mesh = nodeInfo.node.meshes[0];
            if (x < mesh.aabb.min[0] || y < mesh.aabb.min[1] || x > mesh.aabb.max[0] || y > mesh.aabb.max[1]) continue;

            assert(mesh.heightmap);
            const xCell = ((x - mesh.aabb.min[0]) / (mesh.aabb.max[0] - mesh.aabb.min[0]) * HEIGHTMAP_DIM) | 0;
            const yCell = ((y - mesh.aabb.min[1]) / (mesh.aabb.max[1] - mesh.aabb.min[1]) * HEIGHTMAP_DIM) | 0;
            const heightmapIndex = Math.min(HEIGHTMAP_DIM - 1, yCell) * HEIGHTMAP_DIM + Math.min(HEIGHTMAP_DIM - 1, xCell);

            if (mesh.heightmap[heightmapIndex] < 0 && nodeInfo.node.footprint) {
                // unpopulated cell. If it is in the building footprint, return undefined height
                nodeInfo.node.footprint.grid.query(new Point(x, y), new Point(x, y), candidates);
                if (candidates.length > 0) {
                    return {height: undefined, hidden: nodeInfo.hiddenByReplacement, verticalScale: nodeInfo.evaluatedScale[2]};
                }
                continue;
            }
            if (nodeInfo.hiddenByReplacement) return; // better luck with the next source
            return {height: mesh.heightmap[heightmapIndex], hidden: false, verticalScale: nodeInfo.evaluatedScale[2]};
        }
    }
}

function expressionRequiresReevaluation(e: any, brightnessChanged: boolean): boolean {
    assert(e.kind === 'constant' || e instanceof ZoomConstantExpression);
    return !e.isLightConstant && brightnessChanged;
}

function encodeEmissionToByte(emission: number) {
    const clampedEmission = clamp(emission, 0, 2);
    return Math.min(Math.round(0.5 * clampedEmission * 255), 255);
}

function addPBRVertex(vertexArray: FeatureVertexArray, color: number, colorMix: Vec4, rmea: Vec4, heightBasedEmissionMultiplierParams: [number, number, number, number, number], zMin: number, zMax: number, lightsFeatureArray: ?FeatureVertexArray) {
    let r = ((color & 0xF000) | ((color & 0xF000) >> 4)) >> 8;
    let g = ((color & 0x0F00) | ((color & 0x0F00) >> 4)) >> 4;
    let b = (color & 0x00F0) | ((color & 0x00F0) >> 4);

    if (colorMix[3] > 0) {
        r = interpolate(r, 255 * colorMix[0], colorMix[3]);
        g = interpolate(g, 255 * colorMix[1], colorMix[3]);
        b = interpolate(b, 255 * colorMix[2], colorMix[3]);
    }

    const a0 = (r << 8) | g;
    const a1 = (b << 8) | Math.floor(rmea[3] * 255);
    const a2 = (encodeEmissionToByte(rmea[2]) << 8) | ((rmea[0] * 15) << 4) | (rmea[1] * 15);

    const emissionMultiplierStart = clamp(heightBasedEmissionMultiplierParams[0], 0, 1);
    const emissionMultiplierFinish = clamp(heightBasedEmissionMultiplierParams[1], 0, 1);
    const emissionMultiplierValueStart = clamp(heightBasedEmissionMultiplierParams[2], 0, 1);
    const emissionMultiplierValueFinish = clamp(heightBasedEmissionMultiplierParams[3], 0, 1);

    let a3, b0, b1, b2;

    if (emissionMultiplierStart !== emissionMultiplierFinish && zMax !== zMin &&
        emissionMultiplierFinish !== emissionMultiplierStart) {
        const zRange = zMax - zMin;
        b0 = 1.0 / (zRange * (emissionMultiplierFinish - emissionMultiplierStart));
        b1 = -(zMin + zRange * emissionMultiplierStart) /
                       (zRange * (emissionMultiplierFinish - emissionMultiplierStart));
        const power = clamp(heightBasedEmissionMultiplierParams[4], -1, 1);
        b2 = Math.pow(10, power);
        a3 = (emissionMultiplierValueStart * 255.0 << 8) | (emissionMultiplierValueFinish * 255.0);
    } else {
        a3 = (255 << 8) | 255;
        b0 = 0;
        b1 = 1;
        b2 = 1;
    }

    vertexArray.emplaceBack(a0, a1, a2, a3, b0, b1, b2);
    if (lightsFeatureArray) {
        const size = lightsFeatureArray.length;
        lightsFeatureArray.clear();
        for (let j = 0; j < size; j++) {
            lightsFeatureArray.emplaceBack(a0, a1, a2, a3, b0, b1, b2);
        }
    }
}

function updateNodeFeatureVertices(nodeInfo: Tiled3dModelFeature, doorLightChanged: boolean) {
    const node = nodeInfo.node;
    let i = 0;
    for (const mesh of node.meshes) {
        if (node.lights && node.lightMeshIndex === i) continue;
        if (!mesh.featureData) continue;
        // initialize featureArray
        mesh.featureArray = new FeatureVertexArray();
        mesh.featureArray.reserve(mesh.featureData.length);
        let pendingDoorLightUpdate = doorLightChanged;
        for (const feature of mesh.featureData) {
            let lightsFeatureArray;
            const id = feature & 0xFFFF;
            const partId = (id & 0xf) < 8 ? (id & 0xf) : 0;
            const featureColor = (feature >> 16) & 0xFFFF;
            const rmea = nodeInfo.evaluatedRMEA[partId];
            const evaluatedColor = nodeInfo.evaluatedColor[partId];
            const emissionParams = nodeInfo.emissionHeightBasedParams[partId];
            if (pendingDoorLightUpdate && partId === PartIndices.door && node.lights) {
                lightsFeatureArray = new FeatureVertexArray();
                lightsFeatureArray.resize(node.lights.length * 10);
            }
            addPBRVertex(mesh.featureArray, featureColor, evaluatedColor, rmea, emissionParams, mesh.aabb.min[2], mesh.aabb.max[2], lightsFeatureArray);
            if (lightsFeatureArray && pendingDoorLightUpdate) {
                pendingDoorLightUpdate = false;
                const lightsMesh = node.meshes[node.lightMeshIndex];
                lightsMesh.featureArray = lightsFeatureArray;
                lightsMesh.featureArray._trim();
            }
        }
        mesh.featureArray._trim();
        i++;
    }

}

register(Tiled3dModelBucket, 'Tiled3dModelBucket', {omit: ['layers']});
register(Tiled3dModelFeature, 'Tiled3dModelFeature');

export default Tiled3dModelBucket;
