// @flow

import Point from '@mapbox/point-geometry';

import loadGeometry from './load_geometry.js';
import toEvaluationFeature from './evaluation_feature.js';
import EXTENT from './extent.js';
import featureFilter from '../style-spec/feature_filter/index.js';
import Grid from 'grid-index';
import DictionaryCoder from '../util/dictionary_coder.js';
import vt from '@mapbox/vector-tile';
import Protobuf from 'pbf';
import GeoJSONFeature from '../util/vectortile_to_geojson.js';
import {arraysIntersect, mapObject, extend} from '../util/util.js';
import {OverscaledTileID} from '../source/tile_id.js';
import {register} from '../util/web_worker_transfer.js';
import EvaluationParameters from '../style/evaluation_parameters.js';
import SourceFeatureState from '../source/source_state.js';
import {polygonIntersectsBox} from '../util/intersection_tests.js';
import {PossiblyEvaluated} from '../style/properties.js';
import {FeatureIndexArray} from './array_types.js';
import {DEMSampler} from '../terrain/elevation.js';

import type StyleLayer from '../style/style_layer.js';
import type {QueryFeature} from '../util/vectortile_to_geojson.js';
import type {FeatureFilter} from '../style-spec/feature_filter/index.js';
import type Transform from '../geo/transform.js';
import type {FilterSpecification, PromoteIdSpecification} from '../style-spec/types.js';
import type {TilespaceQueryGeometry} from '../style/query_geometry.js';
import type {FeatureIndex as FeatureIndexStruct} from './array_types.js';
import type {TileTransform} from '../geo/projection/tile_transform.js';

type QueryParameters = {
    pixelPosMatrix: Float32Array,
    transform: Transform,
    tileResult: TilespaceQueryGeometry,
    tileTransform: TileTransform,
    params: {
        filter: FilterSpecification,
        layers: Array<string>,
        availableImages: Array<string>
    }
}

export type QueryResult = {[_: string]: Array<{ featureIndex: number, feature: QueryFeature }>};

type FeatureIndices = {
    bucketIndex: number,
    sourceLayerIndex: number,
    featureIndex: number,
    layoutVertexArrayOffset: number
} | FeatureIndexStruct;

class FeatureIndex {
    tileID: OverscaledTileID;
    x: number;
    y: number;
    z: number;
    grid: Grid;
    featureIndexArray: FeatureIndexArray;
    promoteId: ?PromoteIdSpecification;

    rawTileData: ArrayBuffer;
    bucketLayerIDs: Array<Array<string>>;

    vtLayers: {[_: string]: VectorTileLayer};
    vtFeatures: {[_: string]: VectorTileFeature[]};
    sourceLayerCoder: DictionaryCoder;

    constructor(tileID: OverscaledTileID, promoteId?: ?PromoteIdSpecification) {
        this.tileID = tileID;
        this.x = tileID.canonical.x;
        this.y = tileID.canonical.y;
        this.z = tileID.canonical.z;
        this.grid = new Grid(EXTENT, 16, 0);
        this.featureIndexArray = new FeatureIndexArray();
        this.promoteId = promoteId;
    }

    insert(feature: VectorTileFeature, geometry: Array<Array<Point>>, featureIndex: number, sourceLayerIndex: number, bucketIndex: number, layoutVertexArrayOffset: number = 0) {
        const key = this.featureIndexArray.length;
        this.featureIndexArray.emplaceBack(featureIndex, sourceLayerIndex, bucketIndex, layoutVertexArrayOffset);

        const grid = this.grid;

        for (let r = 0; r < geometry.length; r++) {
            const ring = geometry[r];

            const bbox = [Infinity, Infinity, -Infinity, -Infinity];
            for (let i = 0; i < ring.length; i++) {
                const p = ring[i];
                bbox[0] = Math.min(bbox[0], p.x);
                bbox[1] = Math.min(bbox[1], p.y);
                bbox[2] = Math.max(bbox[2], p.x);
                bbox[3] = Math.max(bbox[3], p.y);
            }

            if (bbox[0] < EXTENT &&
                bbox[1] < EXTENT &&
                bbox[2] >= 0 &&
                bbox[3] >= 0) {
                grid.insert(key, bbox[0], bbox[1], bbox[2], bbox[3]);
            }
        }
    }

    loadVTLayers(): {[_: string]: VectorTileLayer} {
        if (!this.vtLayers) {
            this.vtLayers = new vt.VectorTile(new Protobuf(this.rawTileData)).layers;
            this.sourceLayerCoder = new DictionaryCoder(this.vtLayers ? Object.keys(this.vtLayers).sort() : ['_geojsonTileLayer']);
            this.vtFeatures = {};
            for (const layer in this.vtLayers) {
                this.vtFeatures[layer] = [];
            }
        }
        return this.vtLayers;
    }

    // Finds non-symbol features in this tile at a particular position.
    query(args: QueryParameters, styleLayers: {[_: string]: StyleLayer}, serializedLayers: {[_: string]: Object}, sourceFeatureState: SourceFeatureState): QueryResult {
        this.loadVTLayers();
        const params = args.params || {},
            filter = featureFilter(params.filter);
        const tilespaceGeometry = args.tileResult;
        const transform = args.transform;

        const bounds = tilespaceGeometry.bufferedTilespaceBounds;
        const queryPredicate = (bx1, by1, bx2, by2) => {
            return polygonIntersectsBox(tilespaceGeometry.bufferedTilespaceGeometry, bx1, by1, bx2, by2);
        };
        const matching = this.grid.query(bounds.min.x, bounds.min.y, bounds.max.x, bounds.max.y, queryPredicate);
        matching.sort(topDownFeatureComparator);

        let elevationHelper = null;
        if (transform.elevation && matching.length > 0) {
            elevationHelper = DEMSampler.create(transform.elevation, this.tileID);
        }

        const result = {};
        let previousIndex;
        for (let k = 0; k < matching.length; k++) {
            const index = matching[k];

            // don't check the same feature more than once
            if (index === previousIndex) continue;
            previousIndex = index;

            const match = this.featureIndexArray.get(index);
            let featureGeometry = null;
            this.loadMatchingFeature(
                result,
                match,
                filter,
                params.layers,
                params.availableImages,
                styleLayers,
                serializedLayers,
                sourceFeatureState,
                (feature: VectorTileFeature, styleLayer: StyleLayer, featureState: Object, layoutVertexArrayOffset: number = 0) => {
                    if (!featureGeometry) {
                        featureGeometry = loadGeometry(feature, this.tileID.canonical, args.tileTransform);
                    }

                    return styleLayer.queryIntersectsFeature(tilespaceGeometry, feature, featureState, featureGeometry, this.z, args.transform, args.pixelPosMatrix, elevationHelper, layoutVertexArrayOffset);
                }
            );
        }

        return result;
    }

    loadMatchingFeature(
        result: QueryResult,
        featureIndexData: FeatureIndices,
        filter: FeatureFilter,
        filterLayerIDs: Array<string>,
        availableImages: Array<string>,
        styleLayers: {[_: string]: StyleLayer},
        serializedLayers: {[_: string]: Object},
        sourceFeatureState?: SourceFeatureState,
        intersectionTest?: (feature: VectorTileFeature, styleLayer: StyleLayer, featureState: Object, layoutVertexArrayOffset: number) => boolean | number) {

        const {featureIndex, bucketIndex, sourceLayerIndex, layoutVertexArrayOffset} = featureIndexData;
        const layerIDs = this.bucketLayerIDs[bucketIndex];
        if (filterLayerIDs && !arraysIntersect(filterLayerIDs, layerIDs))
            return;

        const sourceLayerName = this.sourceLayerCoder.decode(sourceLayerIndex);
        const sourceLayer = this.vtLayers[sourceLayerName];
        const feature = sourceLayer.feature(featureIndex);

        if (filter.needGeometry) {
            const evaluationFeature = toEvaluationFeature(feature, true);
            if (!filter.filter(new EvaluationParameters(this.tileID.overscaledZ), evaluationFeature, this.tileID.canonical)) {
                return;
            }
        } else if (!filter.filter(new EvaluationParameters(this.tileID.overscaledZ), feature)) {
            return;
        }

        const id = this.getId(feature, sourceLayerName);

        for (let l = 0; l < layerIDs.length; l++) {
            const layerID = layerIDs[l];

            if (filterLayerIDs && filterLayerIDs.indexOf(layerID) < 0) {
                continue;
            }

            const styleLayer = styleLayers[layerID];

            if (!styleLayer) continue;

            let featureState = {};
            if (id !== undefined && sourceFeatureState) {
                // `feature-state` expression evaluation requires feature state to be available
                featureState = sourceFeatureState.getState(styleLayer.sourceLayer || '_geojsonTileLayer', id);
            }

            const serializedLayer = extend({}, serializedLayers[layerID]);

            serializedLayer.paint = evaluateProperties(serializedLayer.paint, styleLayer.paint, feature, featureState, availableImages);
            serializedLayer.layout = evaluateProperties(serializedLayer.layout, styleLayer.layout, feature, featureState, availableImages);

            const intersectionZ = !intersectionTest || intersectionTest(feature, styleLayer, featureState, layoutVertexArrayOffset);
            if (!intersectionZ) {
                // Only applied for non-symbol features
                continue;
            }

            const geojsonFeature = new GeoJSONFeature(feature, this.z, this.x, this.y, id);
            geojsonFeature.layer = serializedLayer;
            let layerResult = result[layerID];
            if (layerResult === undefined) {
                layerResult = result[layerID] = [];
            }

            layerResult.push({featureIndex, feature: geojsonFeature, intersectionZ});
        }
    }

    // Given a set of symbol indexes that have already been looked up,
    // return a matching set of GeoJSONFeatures
    lookupSymbolFeatures(symbolFeatureIndexes: Array<number>,
                         serializedLayers: {[string]: StyleLayer},
                         bucketIndex: number,
                         sourceLayerIndex: number,
                         filterSpec: FilterSpecification,
                         filterLayerIDs: Array<string>,
                         availableImages: Array<string>,
                         styleLayers: {[_: string]: StyleLayer}): QueryResult {
        const result = {};
        this.loadVTLayers();

        const filter = featureFilter(filterSpec);

        for (const symbolFeatureIndex of symbolFeatureIndexes) {
            this.loadMatchingFeature(
                result, {
                    bucketIndex,
                    sourceLayerIndex,
                    featureIndex: symbolFeatureIndex,
                    layoutVertexArrayOffset: 0
                },
                filter,
                filterLayerIDs,
                availableImages,
                styleLayers,
                serializedLayers
            );

        }
        return result;
    }

    loadFeature(featureIndexData: FeatureIndices): VectorTileFeature {
        const {featureIndex, sourceLayerIndex} = featureIndexData;

        this.loadVTLayers();
        const sourceLayerName = this.sourceLayerCoder.decode(sourceLayerIndex);

        const featureCache = this.vtFeatures[sourceLayerName];
        if (featureCache[featureIndex]) {
            return featureCache[featureIndex];
        }
        const sourceLayer = this.vtLayers[sourceLayerName];
        const feature = sourceLayer.feature(featureIndex);
        featureCache[featureIndex] = feature;

        return feature;
    }

    hasLayer(id: string): boolean {
        for (const layerIDs of this.bucketLayerIDs) {
            for (const layerID of layerIDs) {
                if (id === layerID) return true;
            }
        }

        return false;
    }

    getId(feature: VectorTileFeature, sourceLayerId: string): string | number | void {
        let id = feature.id;
        if (this.promoteId) {
            const propName = typeof this.promoteId === 'string' ? this.promoteId : this.promoteId[sourceLayerId];
            id = feature.properties[propName];
            if (typeof id === 'boolean') id =  Number(id);
        }
        return id;
    }
}

register(FeatureIndex, 'FeatureIndex', {omit: ['rawTileData', 'sourceLayerCoder']});

export default FeatureIndex;

function evaluateProperties(serializedProperties, styleLayerProperties, feature, featureState, availableImages) {
    return mapObject(serializedProperties, (property, key) => {
        const prop = styleLayerProperties instanceof PossiblyEvaluated ? styleLayerProperties.get(key) : null;
        return prop && prop.evaluate ? prop.evaluate(feature, featureState, availableImages) : prop;
    });
}

function topDownFeatureComparator(a, b) {
    return b - a;
}
