// @flow

const Point = require('@mapbox/point-geometry');
const loadGeometry = require('./load_geometry');
const EXTENT = require('./extent');
const featureFilter = require('../style-spec/feature_filter');
const createStructArrayType = require('../util/struct_array');
const Grid = require('grid-index');
const DictionaryCoder = require('../util/dictionary_coder');
const vt = require('@mapbox/vector-tile');
const Protobuf = require('pbf');
const GeoJSONFeature = require('../util/vectortile_to_geojson');
const arraysIntersect = require('../util/util').arraysIntersect;
const TileCoord = require('../source/tile_coord');

import type CollisionIndex from '../symbol/collision_index';
import type StyleLayer from '../style/style_layer';
import type {SerializedStructArray} from '../util/struct_array';
import type {FeatureFilter} from '../style-spec/feature_filter';
import type {Transferable} from '../types/transferable';

const FeatureIndexArray = createStructArrayType({
    members: [
        // the index of the feature in the original vectortile
        { type: 'Uint32', name: 'featureIndex' },
        // the source layer the feature appears in
        { type: 'Uint16', name: 'sourceLayerIndex' },
        // the bucket the feature appears in
        { type: 'Uint16', name: 'bucketIndex' }
    ]
});

type QueryParameters = {
    scale: number,
    bearing: number,
    tileSize: number,
    queryGeometry: Array<Array<Point>>,
    additionalRadius: number,
    params: {
        filter: FilterSpecification,
        layers: Array<string>,
    },
    tileSourceMaxZoom: number,
    collisionBoxArray: any,
    sourceID: string
}

export type SerializedFeatureIndex = {
    coord: TileCoord,
    overscaling: number,
    grid: ArrayBuffer,
    featureIndexArray: SerializedStructArray,
    bucketLayerIDs: Array<Array<string>>
}

class FeatureIndex {
    coord: TileCoord;
    overscaling: number;
    x: number;
    y: number;
    z: number;
    grid: Grid;
    featureIndexArray: FeatureIndexArray;

    rawTileData: ArrayBuffer;
    bucketLayerIDs: Array<Array<string>>;

    vtLayers: {[string]: VectorTileLayer};
    sourceLayerCoder: DictionaryCoder;

    collisionIndex: CollisionIndex;

    static deserialize(serialized: SerializedFeatureIndex,
                       rawTileData: ArrayBuffer) {
        const coord = serialized.coord;
        const self = new FeatureIndex(
            new TileCoord(coord.z, coord.x, coord.y, coord.w),
            serialized.overscaling,
            new Grid(serialized.grid),
            new FeatureIndexArray(serialized.featureIndexArray));

        self.rawTileData = rawTileData;
        self.bucketLayerIDs = serialized.bucketLayerIDs;

        return self;
    }

    constructor(coord: TileCoord,
                overscaling: number,
                grid?: Grid,
                featureIndexArray?: FeatureIndexArray) {
        this.coord = coord;
        this.overscaling = overscaling;
        this.x = coord.x;
        this.y = coord.y;
        this.z = coord.z - Math.log(overscaling) / Math.LN2;
        this.grid = grid || new Grid(EXTENT, 16, 0);
        this.featureIndexArray = featureIndexArray || new FeatureIndexArray();
    }

    insert(feature: VectorTileFeature, geometry: Array<Array<Point>>, featureIndex: number, sourceLayerIndex: number, bucketIndex: number) {
        const key = this.featureIndexArray.length;
        this.featureIndexArray.emplaceBack(featureIndex, sourceLayerIndex, bucketIndex);

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

            this.grid.insert(key, bbox[0], bbox[1], bbox[2], bbox[3]);
        }
    }

    setCollisionIndex(collisionIndex: CollisionIndex) {
        this.collisionIndex = collisionIndex;
    }

    serialize(transferables?: Array<Transferable>): SerializedFeatureIndex {
        const grid = this.grid.toArrayBuffer();
        if (transferables) {
            transferables.push(grid);
        }
        return {
            coord: this.coord,
            overscaling: this.overscaling,
            grid: grid,
            featureIndexArray: this.featureIndexArray.serialize(transferables),
            bucketLayerIDs: this.bucketLayerIDs
        };
    }

    // Finds features in this tile at a particular position.
    query(args: QueryParameters, styleLayers: {[string]: StyleLayer}) {
        if (!this.vtLayers) {
            this.vtLayers = new vt.VectorTile(new Protobuf(this.rawTileData)).layers;
            this.sourceLayerCoder = new DictionaryCoder(this.vtLayers ? Object.keys(this.vtLayers).sort() : ['_geojsonTileLayer']);
        }

        const result = {};

        const params = args.params || {},
            pixelsToTileUnits = EXTENT / args.tileSize / args.scale,
            filter = featureFilter(params.filter);

        const queryGeometry = args.queryGeometry;
        const additionalRadius = args.additionalRadius * pixelsToTileUnits;

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (let i = 0; i < queryGeometry.length; i++) {
            const ring = queryGeometry[i];
            for (let k = 0; k < ring.length; k++) {
                const p = ring[k];
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            }
        }

        const matching = this.grid.query(minX - additionalRadius, minY - additionalRadius, maxX + additionalRadius, maxY + additionalRadius);
        matching.sort(topDownFeatureComparator);
        this.filterMatching(result, matching, this.featureIndexArray, queryGeometry, filter, params.layers, styleLayers, args.bearing, pixelsToTileUnits);

        const matchingSymbols = this.collisionIndex ?
            this.collisionIndex.queryRenderedSymbols(queryGeometry, this.coord, args.tileSourceMaxZoom, EXTENT / args.tileSize, args.collisionBoxArray, args.sourceID) :
            [];
        matchingSymbols.sort();
        this.filterMatching(result, matchingSymbols, args.collisionBoxArray, queryGeometry, filter, params.layers, styleLayers, args.bearing, pixelsToTileUnits);

        return result;
    }

    filterMatching(
        result: {[string]: Array<{ featureIndex: number, feature: GeoJSONFeature }>},
        matching: Array<any>,
        array: any,
        queryGeometry: Array<Array<Point>>,
        filter: FeatureFilter,
        filterLayerIDs: Array<string>,
        styleLayers: {[string]: StyleLayer},
        bearing: number,
        pixelsToTileUnits: number
    ) {
        let previousIndex;
        for (let k = 0; k < matching.length; k++) {
            const index = matching[k];

            // don't check the same feature more than once
            if (index === previousIndex) continue;
            previousIndex = index;

            const match = array.get(index);

            const layerIDs = this.bucketLayerIDs[match.bucketIndex];
            if (filterLayerIDs && !arraysIntersect(filterLayerIDs, layerIDs)) continue;

            const sourceLayerName = this.sourceLayerCoder.decode(match.sourceLayerIndex);
            const sourceLayer = this.vtLayers[sourceLayerName];
            const feature = sourceLayer.feature(match.featureIndex);

            if (!filter({zoom: this.coord.z}, feature)) continue;

            let geometry = null;

            for (let l = 0; l < layerIDs.length; l++) {
                const layerID = layerIDs[l];

                if (filterLayerIDs && filterLayerIDs.indexOf(layerID) < 0) {
                    continue;
                }

                const styleLayer = styleLayers[layerID];
                if (!styleLayer) continue;

                if (styleLayer.type !== 'symbol') {
                    // all symbols already match the style
                    if (!geometry) {
                        geometry = loadGeometry(feature);
                    }
                    if (!styleLayer.queryIntersectsFeature(queryGeometry, feature, geometry, this.z, bearing, pixelsToTileUnits)) {
                        continue;
                    }
                }

                const geojsonFeature = new GeoJSONFeature(feature, this.z, this.x, this.y);
                (geojsonFeature: any).layer = styleLayer.serialize();
                let layerResult = result[layerID];
                if (layerResult === undefined) {
                    layerResult = result[layerID] = [];
                }
                layerResult.push({ featureIndex: index, feature: geojsonFeature });
            }
        }
    }

    hasLayer(id: string) {
        for (const layerIDs of this.bucketLayerIDs) {
            for (const layerID of layerIDs) {
                if (id === layerID) return true;
            }
        }

        return false;
    }
}

module.exports = FeatureIndex;

function topDownFeatureComparator(a, b) {
    return b - a;
}
