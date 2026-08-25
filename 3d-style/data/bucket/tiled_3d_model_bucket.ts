import assert from '../../../src/style-spec/util/assert';
import Point from '@mapbox/point-geometry';
import browser from '../../../src/util/browser';
import {register} from '../../../src/util/web_worker_transfer';
import {uploadNode, destroyNodeArrays, destroyBuffers, ModelTraits, HEIGHTMAP_DIM, PartNames} from '../model';
import {ModelPartStyleUBO, MODEL_PART_COUNT, MODEL_PART_STYLE_FLOATS} from './model_part_style_ubo';
import {clamp} from '../../../src/util/util';
import {DEMSampler} from '../../../src/terrain/elevation';
import {ZoomConstantExpression} from '../../../src/style-spec/expression/index';
import {Aabb} from '../../../src/util/primitives';
import {vec3, mat4} from 'gl-matrix';
import deepEqual from '../../../src/style-spec/util/deep_equal';
import featureFilter, {type FeatureFilter} from '../../../src/style-spec/feature_filter/index';
import EvaluationParameters from '../../../src/style/evaluation_parameters';

import type {OverscaledTileID, CanonicalTileID, UnwrappedTileID} from '../../../src/source/tile_id';
import type ModelStyleLayer from '../../style/style_layer/model_style_layer';
import type {ReplacementSource} from '../../source/replacement_source';
import type {Bucket} from '../../../src/data/bucket';
import type {ModelNode} from '../model';
import type {EvaluationFeature} from '../../../src/data/evaluation_feature';
import type Context from '../../../src/gl/context';
import type {FilterSpecification, ProjectionSpecification} from '../../../src/style-spec/types';
import type Painter from '../../../src/render/painter';
import type {vec4} from 'gl-matrix';
import type {ITerrainRenderer} from '../../../src/render/terrain_plugin';
import type FeatureIndex from '../../../src/data/feature_index';
import type GridIndex from '../../../src/symbol/grid_index';
import type {TileFootprint} from '../../../3d-style/util/conflation';
import type {FeatureStates} from '../../../src/source/source_state';
import type {FeatureState, GlobalProperties} from '../../../src/style-spec/expression/index';
import type {PossiblyEvaluatedValue} from '../../../src/style/properties';
import type {ImageId} from '../../../src/style-spec/expression/types/image_id';

const lookup = new Float32Array(512 * 512);
const passLookup = new Uint8Array(512 * 512);

const heightQueryAabbMinScratch: [number, number, number] = [0, 0, 0];
const heightQueryAabbMaxScratch: [number, number, number] = [0, 0, 0];

function getNodeHeight(node: ModelNode): number {
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

function addAABBsToGridIndex(node: ModelNode, key: number, grid: GridIndex) {
    if (node.meshes) {
        for (const mesh of node.meshes) {
            if (mesh.aabb.min[0] === Infinity) continue;
            const meshAabb = Aabb.applyTransform(mesh.aabb, node.globalMatrix);
            grid.insert(key, meshAabb.min[0], meshAabb.min[1], meshAabb.max[0], meshAabb.max[1]);
        }
    }
    if (node.children) {
        for (const child of node.children) {
            addAABBsToGridIndex(child, key, grid);
        }
    }
}

assert(PartNames.length === MODEL_PART_COUNT, 'the part style block must have one entry per part the tiler can tag');

export class Tiled3dModelFeature {
    feature: EvaluationFeature;
    evaluatedColor: Array<vec4>;
    evaluatedRMEA: Array<vec4>;
    evaluatedTranslation: [number, number, number];
    evaluatedScale: [number, number, number];
    hiddenByReplacement: boolean;
    hasTranslucentParts!: boolean;
    node: ModelNode;
    aabb: Aabb;
    emissionHeightBasedParams: Array<[number, number, number, number, number]>;
    // The evaluated fields above, laid out as the shader's ModelPartStyleUniform block.
    partStyle: Float32Array;
    partStyleUBO: ModelPartStyleUBO | null;
    needsPartStyleUBO: boolean;
    cameraCollisionOpacity: number;
    targetLod: number;
    state: FeatureState | null;
    constructor(node: ModelNode) {
        this.node = node;
        this.evaluatedRMEA = [[1, 0, 0, 1],
            [1, 0, 0, 1],   // wall
            [1, 0, 0, 1],   // door
            [1, 0, 0, 1],   // roof
            [0.4, 1, 0, 1], // window
            [1, 0, 0, 1],   // lamp
            [1, 0, 0, 1]];  // logo
        this.hiddenByReplacement = false;
        this.evaluatedTranslation = [0, 0, 0];
        this.evaluatedScale = [1, 1, 1];
        this.evaluatedColor = [];
        this.emissionHeightBasedParams = [];
        this.partStyle = new Float32Array(MODEL_PART_STYLE_FLOATS);
        this.partStyleUBO = null;
        this.needsPartStyleUBO = false;
        this.cameraCollisionOpacity = 1;
        this.targetLod = -1;
        // Needs to calculate geometry
        this.feature = {type: 'Point', id: node.id, geometry: [], properties: {'height': getNodeHeight(node)}};
        this.aabb = this._getLocalBounds();
        this.state = null;
    }
    _getLocalBounds(): Aabb {
        if (!this.node.meshes) {
            return new Aabb([Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]);
        }
        if (!this.aabb) {
            let i = 0;
            const aabb = new Aabb([Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]);
            for (const mesh of this.node.meshes) {
                if (this.node.lightMeshIndex !== i) {
                    mesh.transformedAabb = Aabb.applyTransformFast(mesh.aabb, this.node.globalMatrix);
                    aabb.encapsulate(mesh.transformedAabb);
                }
                i++;
            }
            this.aabb = aabb;
        }
        return this.aabb;
    }
}

class Tiled3dModelBucket implements Bucket {
    requiresStandardRuntime = true;
    // Discriminator tag so core code (feature_index) can identify this bucket type without a
    // static value import of the class. Set as an own enumerable field, so it survives transfer.
    readonly isTiled3dModelBucket = true;

    id: OverscaledTileID;
    uploaded: boolean;
    modelTraits!: number;
    hasPattern: boolean;
    layers: Array<ModelStyleLayer>;
    layerIds: Array<string>;
    stateDependentLayers!: Array<ModelStyleLayer>;
    stateDependentLayerIds: Array<string>;
    nodesInfo: Array<Tiled3dModelFeature>;
    zoom: number;
    projection: ProjectionSpecification;
    terrainTile: CanonicalTileID | null | undefined;
    terrainExaggeration: number | null | undefined;
    replacementUpdateTime: number;
    elevationReadFromZ: number;
    dirty: boolean;
    brightness: number | null | undefined;
    needsPartStyleUBOs: boolean;
    states: FeatureStates;
    filter: FeatureFilter | null;
    worldview: string | undefined;
    hasAppearances: boolean | null;
    constructor(
        layers: Array<ModelStyleLayer>,
        nodes: Array<ModelNode>,
        id: OverscaledTileID,
        hasMbxMeshFeatures: boolean,
        hasMeshoptCompression: boolean,
        brightness: number | null | undefined,
        featureIndex: FeatureIndex,
        worldview: string | undefined,
    ) {
        this.id = id;
        this.layers = layers;
        this.layerIds = this.layers.map(layer => layer.fqid);
        this.stateDependentLayerIds = this.layers.filter((l) => l.isStateDependent()).map((l) => l.id);
        this.modelTraits |= ModelTraits.CoordinateSpaceTile;
        this.uploaded = false;
        this.hasPattern = false;
        if (hasMbxMeshFeatures) {
            this.modelTraits |= ModelTraits.HasMapboxMeshFeatures;
        }
        if (hasMeshoptCompression) {
            this.modelTraits |= ModelTraits.HasMeshoptCompression;
        }
        this.zoom = -1;
        this.terrainExaggeration = 1;
        this.projection = {name: 'mercator'};
        this.replacementUpdateTime = 0;
        this.elevationReadFromZ = 0xff; // Re-read if underlying DEM zoom changes.
        this.brightness = brightness;
        this.worldview = worldview;
        this.dirty = true;
        this.needsPartStyleUBOs = false;
        this.filter = null;

        this.nodesInfo = [];
        for (const node of nodes) {
            this.nodesInfo.push(new Tiled3dModelFeature(node));
            addAABBsToGridIndex(node, featureIndex.featureIndexArray.length, featureIndex.grid);
            featureIndex.featureIndexArray.emplaceBack(this.nodesInfo.length - 1, 0 /*sourceLayerIndex*/, featureIndex.bucketLayerIDs.length - 1, 0);
        }
        this.states = {};
        this.hasAppearances = null;
    }

    updateFootprints(id: UnwrappedTileID, footprints: Array<TileFootprint>) {
        for (const nodeInfo of this.getNodesInfo()) {
            const node = nodeInfo.node;
            if (!node.footprint) {
                continue;
            }
            footprints.push({
                footprint: node.footprint,
                id
            });
        }
    }

    updateAppearances(_canonical?: CanonicalTileID, _featureState?: FeatureStates, _availableImages?: Array<ImageId>, _globalProperties?: GlobalProperties) {
        return {
            hasLayoutChanges: false,
            hasUboChanges: false
        };
    }

    update(states: FeatureStates) {
        const withStateUpdates = Object.keys(states).length !== 0;
        if (withStateUpdates && !this.stateDependentLayers.length) return;
        const layers = withStateUpdates ? this.stateDependentLayers : this.layers;
        if (!deepEqual(states, this.states)) {
            for (const layer of layers) {
                this.evaluate(layer, states);
            }
        }
        this.states = structuredClone(states);
    }

    populate() {
        console.log("populate 3D model bucket");
    }

    uploadPending(): boolean {
        return !this.uploaded || this.needsPartStyleUBOs;
    }

    upload(context: Context) {
        if (this.needsPartStyleUBOs) {
            this.createPartStyleUBOs(context);
            this.needsPartStyleUBOs = false;
        }

        if (!this.uploaded) {
            const nodesInfo = this.getNodesInfo();
            for (const nodeInfo of nodesInfo) {
                uploadNode(nodeInfo.node, context, true);
            }
            // Now destroy all buffers
            for (const nodeInfo of nodesInfo) {
                destroyNodeArrays(nodeInfo.node);
            }
            this.uploaded = true;
        }
    }

    createPartStyleUBOs(context: Context) {
        for (const nodeInfo of this.getNodesInfo()) {
            if (!nodeInfo.needsPartStyleUBO) continue;
            assert(!nodeInfo.partStyleUBO);
            nodeInfo.partStyleUBO = new ModelPartStyleUBO(context, nodeInfo.partStyle);
            nodeInfo.needsPartStyleUBO = false;
        }
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
            this.projection = projection;
            this.brightness = calculatedBrightness;
            // reset state so nodes get re-evaluated
            const nodesInfo = this.getNodesInfo();
            for (const nodeInfo of nodesInfo) {
                nodeInfo.state = null;
            }
            return true;
        }
        return false;
    }

    evaluateTransform(painter: Painter, layer: ModelStyleLayer) {
        if (painter.transform.zoom === this.zoom) return;
        this.zoom = painter.transform.zoom;
        const nodesInfo = this.getNodesInfo();
        const canonical = this.id.canonical;
        for (const nodeInfo of nodesInfo) {
            const evaluationFeature = nodeInfo.feature;

            nodeInfo.evaluatedTranslation = layer.paint.get('model-translation').evaluate(evaluationFeature, {}, canonical);
            nodeInfo.evaluatedScale = layer.paint.get('model-scale').evaluate(evaluationFeature, {}, canonical);
        }
    }

    evaluate(layer: ModelStyleLayer, states?: FeatureStates) {
        const nodesInfo = this.getNodesInfo();
        for (const nodeInfo of nodesInfo) {
            if (!nodeInfo.node.meshes) continue;
            const evaluationFeature = nodeInfo.feature;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const state = states && states[evaluationFeature.id];
            if (deepEqual(state, nodeInfo.state)) continue;
            nodeInfo.state = structuredClone(state);
            const hasFeatures = nodeInfo.node.meshes && nodeInfo.node.meshes[0].hasFeatureData;
            const canonical = this.id.canonical;
            nodeInfo.hasTranslucentParts = false;

            if (hasFeatures) {
                for (let i = 0; i < PartNames.length; i++) {
                    const part = PartNames[i];
                    if (part.length) {
                        evaluationFeature.properties['part'] = part;
                    }

                    const color = layer.paint.get('model-color').evaluate(evaluationFeature, state, canonical).toPremultipliedRenderColor(null);

                    const colorMixIntensity = layer.paint.get('model-color-mix-intensity').evaluate(evaluationFeature, state, canonical);
                    nodeInfo.evaluatedColor[i] = [color.r, color.g, color.b, colorMixIntensity];

                    nodeInfo.evaluatedRMEA[i][0] = layer.paint.get('model-roughness').evaluate(evaluationFeature, state, canonical);
                    // For the first version metallic is not styled

                    nodeInfo.evaluatedRMEA[i][2] = layer.paint.get('model-emissive-strength').evaluate(evaluationFeature, state, canonical);
                    nodeInfo.evaluatedRMEA[i][3] = color.a;

                    nodeInfo.emissionHeightBasedParams[i] = layer.paint.get('model-height-based-emissive-strength-multiplier').evaluate(evaluationFeature, state, canonical);

                    if (!nodeInfo.hasTranslucentParts && color.a < 1.0) {
                        nodeInfo.hasTranslucentParts = true;
                    }
                }
                delete evaluationFeature.properties['part'];
            } else {

                nodeInfo.evaluatedRMEA[0][2] = layer.paint.get('model-emissive-strength').evaluate(evaluationFeature, state, canonical);
            }

            nodeInfo.evaluatedTranslation = layer.paint.get('model-translation').evaluate(evaluationFeature, state, canonical);
            nodeInfo.evaluatedScale = layer.paint.get('model-scale').evaluate(evaluationFeature, state, canonical);

            // Last, so the block reflects everything this iteration evaluated.
            if (hasFeatures) {
                buildPartStyle(nodeInfo);
                if (nodeInfo.partStyleUBO) {
                    nodeInfo.partStyleUBO.update(nodeInfo.partStyle);
                } else {
                    nodeInfo.needsPartStyleUBO = true;
                    this.needsPartStyleUBOs = true;
                }
            }
        }
        this.dirty = false;
    }

    elevationUpdate(terrain: ITerrainRenderer, exaggeration: number, coord: OverscaledTileID, source: string) {
        assert(terrain);
        const demTile = terrain.findDEMTileFor(coord);
        if (!demTile) return;
        if (demTile.tileID.canonical === this.terrainTile && exaggeration === this.terrainExaggeration) return;

        if (demTile.dem && demTile.tileID.overscaledZ !== this.elevationReadFromZ) {
            this.elevationReadFromZ = demTile.tileID.overscaledZ;
            const dem = DEMSampler.create(terrain, coord, demTile);
            if (!dem) return;
            if (this.modelTraits & ModelTraits.HasMapboxMeshFeatures) {
                this.updateDEM(terrain, dem, coord, source);
            }
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
        this.terrainTile = demTile.tileID.canonical;
        this.terrainExaggeration = exaggeration;
    }

    updateDEM(terrain: ITerrainRenderer, dem: DEMSampler, coord: OverscaledTileID, source: string) {
        let tiles = dem._dem._modifiedForSources[source];
        if (tiles === undefined) {
            dem._dem._modifiedForSources[source] = [];
            tiles = dem._dem._modifiedForSources[source];
        }
        if (tiles.includes(coord.canonical)) {
            return;
        }

        // Resolution of the DEM data.
        const demRes = dem._dem.dim;

        tiles.push(coord.canonical);
        assert(lookup.length <= demRes * demRes);

        let changed = false;
        for (const nodeInfo of this.getNodesInfo()) {
            const node = nodeInfo.node;
            if (!node.footprint || !node.footprint.grid) {
                continue;
            }

            // Convert the bounds of the footprint for this node from its tile coordinates to DEM pixel coordinates.
            const grid = node.footprint.grid;
            const minDem = dem.tileCoordToPixel(grid.min.x, grid.min.y);
            const maxDem = dem.tileCoordToPixel(grid.max.x, grid.max.y);

            const distanceToBorder = Math.min(Math.min(demRes - maxDem.y, minDem.x), Math.min(minDem.y, demRes - maxDem.x));
            if (distanceToBorder < 0) {
                continue; // don't deal with neighbors and landmarks crossing tile borders, fix terrain only for buildings within the tile
            }
            // demAtt is a number of pixels we use to propagate attenuated change to surrounding pixels.
            // this is clamped further when sampling near tile border.
            // The footprint covers a certain region of DEM pixels as indicated with 'minDem' and 'maxDem' (region A).
            // This region is further padded by demAtt pixels to form the region B.
            // First mark all the DEM pixels in region B as unchanged (using 'passLookup' array).
            // +------------+
            // |  +-----+   |
            // |  |  A  |   |
            // |  +-----+ B |
            // +------------+
            const demAtt = clamp(distanceToBorder, 2, 5);
            let minx = Math.max(0, minDem.x - demAtt);
            let miny = Math.max(0, minDem.y - demAtt);
            let maxx = Math.min(maxDem.x + demAtt, demRes - 1);
            let maxy = Math.min(maxDem.y + demAtt, demRes - 1);
            for (let y = miny; y <= maxy; ++y) {
                for (let x = minx; x <= maxx; ++x) {
                    passLookup[y * demRes + x] = 255;
                }
            }

            // Next go through all eligible DEM pixels in region A, mark them as changed and calculate the average height(elevation).
            // Some pixels may be skipped (and therefore aren't eligible) because no footprint geometry overlaps them.
            // This is indicated by the existence of a 'Cell' at a given pixel's position.
            let heightAcc = 0;
            let count = 0;
            for (let celly = 0; celly < grid.cellsY; ++celly) {
                for (let cellx = 0; cellx < grid.cellsX; ++cellx) {
                    const cell = grid.cells[celly * grid.cellsX + cellx];
                    if (!cell) {
                        continue;
                    }
                    const demP = dem.tileCoordToPixel(grid.min.x + cellx / grid.xScale, grid.min.y + celly / grid.yScale);
                    const demPMax = dem.tileCoordToPixel(grid.min.x + (cellx + 1) / grid.xScale, grid.min.y + (celly + 1) / grid.yScale);
                    for (let y = demP.y; y <= Math.min(demPMax.y + 1, demRes - 1); ++y) {
                        for (let x = demP.x; x <= Math.min(demPMax.x + 1, demRes - 1); ++x) {
                            if (passLookup[y * demRes + x] === 255) {
                                passLookup[y * demRes + x] = 0;
                                const height = dem.getElevationAtPixel(x, y);
                                heightAcc += height;
                                count++;
                            }
                        }
                    }
                }
            }

            assert(count);
            const avgHeight = heightAcc / count;
            // See https://github.com/mapbox/mapbox-gl-js-internal/pull/804#issuecomment-1738720351
            // for explanation why bounds should be clamped to 1 and demRes - 2 respectively.
            minx = Math.max(1, minDem.x - demAtt);
            miny = Math.max(1, minDem.y - demAtt);
            maxx = Math.min(maxDem.x + demAtt, demRes - 2);
            maxy = Math.min(maxDem.y + demAtt, demRes - 2);

            // Next, update the DEM pixels in region A (which the footprint overlaps with) by the average height.
            // This effectively flattens the terrain for the given footprint/building.
            // Store the difference of the original height with the average height in 'lookup' array.
            changed = true;
            for (let y = miny; y <= maxy; ++y) {
                for (let x = minx; x <= maxx; ++x) {
                    if (passLookup[y * demRes + x] === 0) {
                        lookup[y * demRes + x] = dem._dem.set(x, y, avgHeight);
                    }
                }
            }

            // Finally propagate the flattened out values to the remaining surrounding pixels (as goverened by demAtt padding) in region B.
            // This ensures a smooth transition between the flattened and the non-flattened regions.
            for (let p = 1; p < demAtt; ++p) {
                minx = Math.max(1, minDem.x - p);
                miny = Math.max(1, minDem.y - p);
                maxx = Math.min(maxDem.x + p, demRes - 2);
                maxy = Math.min(maxDem.y + p, demRes - 2);
                for (let y = miny; y <= maxy; ++y) {
                    for (let x = minx; x <= maxx; ++x) {
                        const indexThis = y * demRes + x;
                        // If DEM pixel is not modified.
                        if (passLookup[indexThis] === 255) {
                            let maxDiff = 0;
                            let maxDiffAbs = 0;
                            let xoffset = -1;
                            let yoffset = -1;
                            for (let j = -1; j <= 1; ++j) {
                                for (let i = -1; i <= 1; ++i) {
                                    const index = (y + j) * demRes + x + i;
                                    if (passLookup[index] >= p) {
                                        continue;
                                    }
                                    const diff = lookup[index];
                                    const diffAbs = Math.abs(diff);
                                    if (diffAbs  > maxDiffAbs) {
                                        maxDiff = diff;
                                        maxDiffAbs = diffAbs;
                                        xoffset = i;
                                        yoffset = j;
                                    }
                                }
                            }

                            if (maxDiffAbs > 0.1) {
                                const diagonalAttenuation = Math.abs(xoffset * yoffset) * 0.5;
                                const attenuation = 1 - (p + diagonalAttenuation) / demAtt;
                                assert(attenuation > 0);
                                const prev = dem._dem.get(x, y);
                                let next = prev + maxDiff * attenuation;

                                // parent - child in the meaning of wave propagation
                                const parent = dem._dem.get(x + xoffset, y + yoffset);
                                const child = dem._dem.get(x - xoffset, y - yoffset, true);
                                // prevent waves
                                if ((next - parent) * (next - child) > 0) {
                                    next = (parent + child) / 2;
                                }
                                lookup[indexThis] = dem._dem.set(x, y, next);
                                passLookup[indexThis] = p;
                            }
                        }
                    }
                }
            }
        }
        if (changed) {
            dem._demTile.needsDEMTextureUpload = true;
            dem._dem._timestamp = browser.now();
        }
    }

    setFilter(filterSpec: FilterSpecification | null) {
        this.filter = filterSpec ? featureFilter(filterSpec) : null;
    }

    getNodesInfo(): Array<Tiled3dModelFeature> {
        if (this.filter) {
            return this.nodesInfo.filter((node) => {
                return this.filter.filter(new EvaluationParameters(this.id.overscaledZ, {worldview: this.worldview}), node.feature, this.id.canonical);
            });
        }
        return this.nodesInfo;
    }

    destroy() {
        const nodesInfo = this.getNodesInfo();
        for (const nodeInfo of nodesInfo) {
            destroyNodeArrays(nodeInfo.node);
            destroyBuffers(nodeInfo.node);
            if (nodeInfo.partStyleUBO) {
                nodeInfo.partStyleUBO.destroy();
                nodeInfo.partStyleUBO = null;
            }
        }
    }

    isEmpty(): boolean {
        return !this.nodesInfo.length;
    }

    updateReplacement(coord: OverscaledTileID, source: ReplacementSource) {
        // Replacement has to be re-checked if the source has been updated since last time
        if (source.updateTime === this.replacementUpdateTime) {
            return;
        }

        this.replacementUpdateTime = source.updateTime;
        const activeReplacements = source.getReplacementRegionsForTile(coord.toUnwrapped());

        for (const nodeInfo of this.getNodesInfo()) {
            const footprint = nodeInfo.node.footprint;
            // Node is visible if its footprint passes the replacement check
            nodeInfo.hiddenByReplacement = !!footprint && !activeReplacements.some(region => region.footprint === footprint);
        }
    }

    getHeightAtTileCoord(x: number, y: number): {
        height: number | null | undefined;
        maxHeight: number;
        hidden: boolean;
        verticalScale: number;
    } | null | undefined {
        const tmpVertex: [number, number, number] = [0, 0, 0];

        const nodeInverse = mat4.identity([]);

        for (const nodeInfo of this.getNodesInfo()) {
            assert(nodeInfo.node.meshes.length > 0);
            const mesh = nodeInfo.node.meshes[0];
            const meshAabb = mesh.transformedAabb;
            if (x < meshAabb.min[0] || y < meshAabb.min[1] || x > meshAabb.max[0] || y > meshAabb.max[1]) continue;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            if (nodeInfo.node.hidden === true) return {height: Infinity, maxHeight: nodeInfo.feature.properties["height"], hidden: false, verticalScale: nodeInfo.evaluatedScale[2]};

            mat4.invert(nodeInverse, nodeInfo.node.globalMatrix);
            tmpVertex[0] = x;
            tmpVertex[1] = y;
            tmpVertex[2] = 0;
            vec3.transformMat4(tmpVertex, tmpVertex, nodeInverse);

            if (nodeInfo.node.meshBVH) {
                const qx = tmpVertex[0];
                const qy = tmpVertex[1];
                heightQueryAabbMinScratch[0] = qx - 1;
                heightQueryAabbMinScratch[1] = qy - 1;
                heightQueryAabbMinScratch[2] = -1000;
                heightQueryAabbMaxScratch[0] = qx + 1;
                heightQueryAabbMaxScratch[1] = qy + 1;
                heightQueryAabbMaxScratch[2] = 1000;
                const height = nodeInfo.node.meshBVH.findHighestPoint(heightQueryAabbMinScratch, heightQueryAabbMaxScratch);
                if (height !== null) {
                    return {height, maxHeight: nodeInfo.feature.properties["height"] as number, hidden: nodeInfo.hiddenByReplacement, verticalScale: nodeInfo.evaluatedScale[2]};
                }
                continue;
            }

            assert(mesh.heightmap);

            const xCell = ((tmpVertex[0] - mesh.aabb.min[0]) / (mesh.aabb.max[0] - mesh.aabb.min[0]) * HEIGHTMAP_DIM) | 0;
            const yCell = ((tmpVertex[1] - mesh.aabb.min[1]) / (mesh.aabb.max[1] - mesh.aabb.min[1]) * HEIGHTMAP_DIM) | 0;
            const heightmapIndex = Math.min(HEIGHTMAP_DIM - 1, yCell) * HEIGHTMAP_DIM + Math.min(HEIGHTMAP_DIM - 1, xCell);
            const heightValue = mesh.heightmap[heightmapIndex];
            if (heightValue < 0 && nodeInfo.node.footprint) {
                // unpopulated cell. If it is in the building footprint, return undefined height
                const candidates: number[] = [];
                nodeInfo.node.footprint.grid.query(new Point(x, y), new Point(x, y), candidates);
                if (candidates.length > 0) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    return {height: undefined, maxHeight: nodeInfo.feature.properties["height"], hidden: nodeInfo.hiddenByReplacement, verticalScale: nodeInfo.evaluatedScale[2]};
                }
                continue;
            }
            if (nodeInfo.hiddenByReplacement) return; // better luck with the next source
            return {height: heightValue, maxHeight: nodeInfo.feature.properties["height"] as number, hidden: false, verticalScale: nodeInfo.evaluatedScale[2]};
        }
    }
}

function expressionRequiresReevaluation<T>(e: PossiblyEvaluatedValue<T>, brightnessChanged: boolean): boolean {
    assert(e.kind === 'constant' || e instanceof ZoomConstantExpression);

    if (e instanceof ZoomConstantExpression) {
        return !e.isLightConstant && brightnessChanged;
    }

    return false;
}

// Rounds a part's style back to the precision it had when packed into per-vertex bytes: roughness
// and metallic to a nibble each, emissive strength and alpha to a byte, and the two gradient values
// to a byte with the 255/256 scale the old decode used.
//
// TEMPORARY. The uniform block holds plain floats and needs none of this. It is here so this change
// renders identically to the per-vertex encoding it replaces, which lets a render test run verify
// the restructuring by itself. Deleting the function and its call is what picks up the better
// precision, and requires updating the landmark baselines.
function quantizeLikeLegacyEncoding(style: Float32Array, o: number) {
    // Roughness and metallic were a nibble each, emissive a byte spanning [0, 2], alpha a byte.
    style[o + 4] = Math.floor(style[o + 4] * 15) * 16 / 255;
    style[o + 5] = Math.floor(style[o + 5] * 15) * 16 / 255;
    style[o + 6] = Math.min(Math.floor(style[o + 6] * 127.5 + 0.5), 255) / 255 * 2;
    style[o + 7] = Math.floor(style[o + 7] * 255) / 255;

    // The two gradient values were a byte each, but were decoded with a 255/256 scale instead of
    // 255/255, so a styled value of 1 read back as 0.99609. That also reproduces the neutral
    // gradient, whose values were both 0xFF.
    const valueBegin = Math.floor(style[o + 10] * 255) / 256;
    const valueFinish = Math.floor((style[o + 10] + style[o + 11]) * 255) / 256;
    style[o + 10] = valueBegin;
    style[o + 11] = valueFinish - valueBegin;
}

// Generates the per-part style values, four vec4 each, that the model vertex shader reads as
// ModelPartStyle.
function buildPartStyle(nodeInfo: Tiled3dModelFeature) {
    const style = nodeInfo.partStyle;
    for (let part = 0; part < PartNames.length; part++) {
        const colorMix = nodeInfo.evaluatedColor[part];
        const rmea = nodeInfo.evaluatedRMEA[part];
        const gradient = nodeInfo.emissionHeightBasedParams[part];

        const begin = clamp(gradient[0], 0, 1);
        const finish = clamp(gradient[1], 0, 1);

        const o = part * 16;
        style[o] = colorMix[0];
        style[o + 1] = colorMix[1];
        style[o + 2] = colorMix[2];
        style[o + 3] = clamp(colorMix[3], 0, 1);

        style[o + 4] = rmea[0];
        style[o + 5] = rmea[1];
        style[o + 6] = clamp(rmea[2], 0, 2);
        style[o + 7] = rmea[3];

        if (begin !== finish) {
            style[o + 8] = begin;
            style[o + 9] = finish;
            style[o + 10] = clamp(gradient[2], 0, 1);
            style[o + 11] = clamp(gradient[3], 0, 1) - style[o + 10];
            style[o + 12] = Math.pow(10, clamp(gradient[4], -1, 1));
        } else {
            // Flat multiplier of 1 spanning the full mesh height. A zero span would divide by zero
            // in the shader.
            style[o + 8] = 0;
            style[o + 9] = 1;
            style[o + 10] = 1;
            style[o + 11] = 0;
            style[o + 12] = 1;
        }

        quantizeLikeLegacyEncoding(style, o);
    }
}

register(Tiled3dModelBucket, 'Tiled3dModelBucket', {omit: ['layers']});
register(Tiled3dModelFeature, 'Tiled3dModelFeature', {omit: ['partStyleUBO']});

export default Tiled3dModelBucket;
