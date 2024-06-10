import Point from '@mapbox/point-geometry';

import loadGeometry from './load_geometry';
import toEvaluationFeature from './evaluation_feature';
import EXTENT from '../style-spec/data/extent';
import featureFilter from '../style-spec/feature_filter/index';
import Grid from 'grid-index';
import DictionaryCoder from '../util/dictionary_coder';
import {VectorTile} from '@mapbox/vector-tile';
import Protobuf from 'pbf';
import GeoJSONFeature from '../util/vectortile_to_geojson';
import {arraysIntersect, mapObject, extend} from '../util/util';
import {OverscaledTileID} from '../source/tile_id';
import {register} from '../util/web_worker_transfer';
import EvaluationParameters from '../style/evaluation_parameters';
import SourceFeatureState from '../source/source_state';
import {polygonIntersectsBox} from '../util/intersection_tests';
import {PossiblyEvaluated} from '../style/properties';
import {FeatureIndexArray} from './array_types';
import {DEMSampler} from '../terrain/elevation';

import type StyleLayer from '../style/style_layer';
import type {QueryResult, QueryFeature} from '../source/query_features';
import type {FeatureStates} from '../source/source_state';
import type {FeatureFilter} from '../style-spec/feature_filter/index';
import type Transform from '../geo/transform';
import type {FilterSpecification, PromoteIdSpecification} from '../style-spec/types';
import type {TilespaceQueryGeometry} from '../style/query_geometry';
import type {FeatureIndex as FeatureIndexStruct} from './array_types';
import type {TileTransform} from '../geo/projection/tile_transform';
import type {VectorTileLayer, VectorTileFeature} from '@mapbox/vector-tile';
import type {GridIndex} from '../types/grid-index';

type QueryParameters = {
    pixelPosMatrix: Float32Array;
    transform: Transform;
    tileResult: TilespaceQueryGeometry;
    tileTransform: TileTransform;
    params: {
        filter: FilterSpecification;
        layers: Array<string>;
        availableImages: Array<string>;
    };
};

type FeatureIndices = {
    bucketIndex: number;
    sourceLayerIndex: number;
    featureIndex: number;
    layoutVertexArrayOffset: number;
} | FeatureIndexStruct;

class FeatureIndex {
    tileID: OverscaledTileID;
    x: number;
    y: number;
    z: number;
    grid: GridIndex;
    featureIndexArray: FeatureIndexArray;
    promoteId: PromoteIdSpecification | null | undefined;

    rawTileData: ArrayBuffer;
    bucketLayerIDs: Array<Array<string>>;

    vtLayers: {
        [_: string]: VectorTileLayer;
    };
    vtFeatures: {
        [_: string]: VectorTileFeature[];
    };
    sourceLayerCoder: DictionaryCoder;
    is3DTile: boolean; // no vector source layers

    constructor(tileID: OverscaledTileID, promoteId?: PromoteIdSpecification | null) {
        this.tileID = tileID;
        this.x = tileID.canonical.x;
        this.y = tileID.canonical.y;
        this.z = tileID.canonical.z;
        this.grid = new Grid(EXTENT, 16, 0);
        this.featureIndexArray = new FeatureIndexArray();
        this.promoteId = promoteId;
        this.is3DTile = false;
    }

    insert(feature: VectorTileFeature, geometry: Array<Array<Point>>, featureIndex: number, sourceLayerIndex: number, bucketIndex: number, layoutVertexArrayOffset: number = 0, envelopePadding: number = 0) {
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

            if (envelopePadding !== 0) {
                bbox[0] -= envelopePadding;
                bbox[1] -= envelopePadding;
                bbox[2] += envelopePadding;
                bbox[3] += envelopePadding;
            }

            if (bbox[0] < EXTENT &&
                bbox[1] < EXTENT &&
                bbox[2] >= 0 &&
                bbox[3] >= 0) {
                grid.insert(key, bbox[0], bbox[1], bbox[2], bbox[3]);
            }
        }
    }

    loadVTLayers(): {
        [_: string]: VectorTileLayer;
        } {
        if (!this.vtLayers) {
            this.vtLayers = new VectorTile(new Protobuf(this.rawTileData)).layers;
            this.sourceLayerCoder = new DictionaryCoder(this.vtLayers ? Object.keys(this.vtLayers).sort() : ['_geojsonTileLayer']);
            this.vtFeatures = {};
            for (const layer in this.vtLayers) {
                this.vtFeatures[layer] = [];
            }
        }
        return this.vtLayers;
    }

    // Finds non-symbol features in this tile at a particular position.
    query(
        args: QueryParameters,
        styleLayers: {
            [_: string]: StyleLayer;
        },
        serializedLayers: {
            [_: string]: any;
        },
        sourceFeatureState: SourceFeatureState,
    ): QueryResult {
        this.loadVTLayers();
        const params = args.params || {},
            // @ts-expect-error - TS2339 - Property 'filter' does not exist on type '{}'.
            filter = featureFilter(params.filter);
        const tilespaceGeometry = args.tileResult;
        const transform = args.transform;

        const bounds = tilespaceGeometry.bufferedTilespaceBounds;
        const queryPredicate = (bx1: number, by1: number, bx2: number, by2: number) => {
            return polygonIntersectsBox(tilespaceGeometry.bufferedTilespaceGeometry, bx1, by1, bx2, by2);
        };
        const matching = this.grid.query(bounds.min.x, bounds.min.y, bounds.max.x, bounds.max.y, queryPredicate);
        matching.sort(topDownFeatureComparator);

        let elevationHelper = null;
        if (transform.elevation && matching.length > 0) {
            elevationHelper = DEMSampler.create(transform.elevation, this.tileID);
        }

        const result: QueryResult = {};
        let previousIndex;
        for (let k = 0; k < matching.length; k++) {
            const index = matching[k];

            // don't check the same feature more than once
            if (index === previousIndex) continue;
            previousIndex = index;

            const match = this.featureIndexArray.get(index);
            let featureGeometry = null;

            if (this.is3DTile) {
                // 3D tile is a single bucket tile.
                const layerID = this.bucketLayerIDs[0][0];
                const layer = styleLayers[layerID];
                if (layer.type !== "model") continue;
                const {queryFeature, intersectionZ} = layer.queryIntersectsMatchingFeature(tilespaceGeometry, match.featureIndex, filter, transform);
                if (queryFeature) {
                    this.appendToResult(result, layerID, match.featureIndex, queryFeature, intersectionZ);
                }
                continue;
            }

            this.loadMatchingFeature(
                result,
                match,
                filter,
                // @ts-expect-error - TS2339 - Property 'layers' does not exist on type '{}'.
                params.layers,
                // @ts-expect-error - TS2339 - Property 'availableImages' does not exist on type '{}'.
                params.availableImages,
                styleLayers,
                serializedLayers,
                sourceFeatureState,
                (feature: VectorTileFeature, styleLayer: StyleLayer, featureState: any, layoutVertexArrayOffset: number = 0) => {
                    if (!featureGeometry) {
                        // @ts-expect-error - TS2345 - Argument of type 'VectorTileFeature' is not assignable to parameter of type 'FeatureWithGeometry'.
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
        styleLayers: {
            [_: string]: StyleLayer;
        },
        serializedLayers: {
            [_: string]: any;
        },
        sourceFeatureState?: SourceFeatureState,
        intersectionTest?: (
            feature: VectorTileFeature,
            styleLayer: StyleLayer,
            featureState: any,
            layoutVertexArrayOffset: number,
        ) => boolean | number) {

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
            // @ts-expect-error - TS2345 - Argument of type 'VectorTileFeature' is not assignable to parameter of type 'Feature'.
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

            let featureState: Record<string, any> = {};
            if (id !== undefined && sourceFeatureState) {
                // `feature-state` expression evaluation requires feature state to be available
                featureState = sourceFeatureState.getState(styleLayer.sourceLayer || '_geojsonTileLayer', id);
            }

            const intersectionZ = !intersectionTest || intersectionTest(feature, styleLayer, featureState, layoutVertexArrayOffset);
            if (!intersectionZ) {
                // Only applied for non-symbol features
                continue;
            }

            const geojsonFeature = new GeoJSONFeature(feature, this.z, this.x, this.y, id);

            const serializedLayer = extend({}, serializedLayers[layerID]);

            serializedLayer.paint = evaluateProperties(serializedLayer.paint, styleLayer.paint, feature, featureState, availableImages);
            serializedLayer.layout = evaluateProperties(serializedLayer.layout, styleLayer.layout, feature, featureState, availableImages);

            geojsonFeature.layer = serializedLayer;
            this.appendToResult(result, layerID, featureIndex, geojsonFeature, intersectionZ);
        }
    }

    appendToResult(result: QueryResult, layerID: string, featureIndex: number, geojsonFeature: QueryFeature, intersectionZ: boolean | number) {
        let layerResult = result[layerID];
        if (layerResult === undefined) {
            layerResult = result[layerID] = [];
        }

        layerResult.push({featureIndex, feature: geojsonFeature, intersectionZ});
    }

    // Given a set of symbol indexes that have already been looked up,
    // return a matching set of GeoJSONFeatures
    lookupSymbolFeatures(
        symbolFeatureIndexes: Array<number>,
        serializedLayers: {
            [key: string]: StyleLayer;
        },
        bucketIndex: number,
        sourceLayerIndex: number,
        filterSpec: FilterSpecification,
        filterLayerIDs: Array<string>,
        availableImages: Array<string>,
        styleLayers: {
            [_: string]: StyleLayer;
        },
    ): QueryResult {
        const result: Record<string, any> = {};
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

    getId(feature: VectorTileFeature, sourceLayerId: string): string | number {
        let id: string | number = feature.id;
        if (this.promoteId) {
            const propName = typeof this.promoteId === 'string' ? this.promoteId : this.promoteId[sourceLayerId];
            if (propName != null)
                id = feature.properties[propName] as string | number;
            if (typeof id === 'boolean') id = Number(id);
        }
        return id;
    }
}

register(FeatureIndex, 'FeatureIndex', {omit: ['rawTileData', 'sourceLayerCoder']});

export default FeatureIndex;

function evaluateProperties(serializedProperties: unknown, styleLayerProperties: unknown, feature: VectorTileFeature, featureState: FeatureStates, availableImages: Array<string>) {
    return mapObject(serializedProperties, (property, key) => {
        const prop = styleLayerProperties instanceof PossiblyEvaluated ? styleLayerProperties.get(key) : null;
        // @ts-expect-error - TS2339 - Property 'evaluate' does not exist on type 'unknown'. | TS2339 - Property 'evaluate' does not exist on type 'unknown'.
        return prop && prop.evaluate ? prop.evaluate(feature, featureState, availableImages) : prop;
    });
}

function topDownFeatureComparator(a: number, b: number) {
    return b - a;
}
