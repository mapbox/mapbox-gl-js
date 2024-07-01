import {getJSON} from '../util/ajax';

import {getPerformanceMeasurement} from '../util/performance';
import GeoJSONWrapper from './geojson_wrapper';
import GeoJSONRT from './geojson_rt';
import vtpbf from 'vt-pbf';
import Supercluster from 'supercluster';
import geojsonvt from 'geojson-vt';
import assert from 'assert';
import VectorTileWorkerSource from './vector_tile_worker_source';
import {createExpression} from '../style-spec/expression/index';

import type {
    RequestedTileParameters,
    WorkerTileParameters,
    WorkerTileCallback,
} from '../source/worker_source';

import type Actor from '../util/actor';
import type StyleLayerIndex from '../style/style_layer_index';

import type {LoadVectorDataCallback} from './load_vector_tile';
import type {RequestParameters, ResponseCallback} from '../util/ajax';
import type {Callback} from '../types/callback';

export type GeoJSONWorkerOptions = {
    source: string;
    cluster: boolean;
    superclusterOptions?: any;
    geojsonVtOptions?: any;
    clusterProperties?: any;
    filter?: Array<unknown>;
    dynamic?: boolean;
};

export type LoadGeoJSONParameters = GeoJSONWorkerOptions & {
    request?: RequestParameters;
    data?: string;
    append?: boolean;
};

export type LoadGeoJSON = (params: LoadGeoJSONParameters, callback: ResponseCallback<any>) => void;

export interface GeoJSONIndex {
    getTile(z: number, x: number, y: number): any;
    // supercluster methods
    getClusterExpansionZoom?(clusterId: number): number;
    getChildren?(clusterId: number): Array<GeoJSON.Feature>;
    getLeaves?(clusterId: number, limit: number, offset: number): Array<GeoJSON.Feature>;
}

function loadGeoJSONTile(params: RequestedTileParameters, callback: LoadVectorDataCallback) {
    const canonical = params.tileID.canonical;

    if (!this._geoJSONIndex) {
        return callback(null, null);  // we couldn't load the file
    }

    const geoJSONTile = this._geoJSONIndex.getTile(canonical.z, canonical.x, canonical.y);
    if (!geoJSONTile) {
        return callback(null, null); // nothing in the given tile
    }

    const geojsonWrapper = new GeoJSONWrapper(geoJSONTile.features);

    // Encode the geojson-vt tile into binary vector tile form.  This
    // is a convenience that allows `FeatureIndex` to operate the same way
    // across `VectorTileSource` and `GeoJSONSource` data.
    let pbf = vtpbf(geojsonWrapper);
    if (pbf.byteOffset !== 0 || pbf.byteLength !== pbf.buffer.byteLength) {
        // Compatibility with node Buffer (https://github.com/mapbox/pbf/issues/35)
        pbf = new Uint8Array(pbf);
    }

    callback(null, {
        vectorTile: geojsonWrapper,
        rawData: pbf.buffer
    });
}

/**
 * The {@link WorkerSource} implementation that supports {@link GeoJSONSource}.
 * This class is designed to be easily reused to support custom source types
 * for data formats that can be parsed/converted into an in-memory GeoJSON
 * representation.  To do so, create it with
 * `new GeoJSONWorkerSource(actor, layerIndex, customLoadGeoJSONFunction)`.
 * For a full example, see [mapbox-gl-topojson](https://github.com/developmentseed/mapbox-gl-topojson).
 *
 * @private
 */
class GeoJSONWorkerSource extends VectorTileWorkerSource {
    _geoJSONIndex: GeoJSONIndex;
    _dynamicIndex: GeoJSONRT;

    /**
     * @param [loadGeoJSON] Optional method for custom loading/parsing of
     * GeoJSON based on parameters passed from the main-thread Source.
     * See {@link GeoJSONWorkerSource#loadGeoJSON}.
     * @private
     */
    constructor(actor: Actor, layerIndex: StyleLayerIndex, availableImages: Array<string>, isSpriteLoaded: boolean, loadGeoJSON?: LoadGeoJSON | null, brightness?: number | null) {
        // @ts-expect-error - TS2345 - Argument of type '(params: RequestedTileParameters, callback: LoadVectorDataCallback) => void' is not assignable to parameter of type 'LoadVectorData'.
        super(actor, layerIndex, availableImages, isSpriteLoaded, loadGeoJSONTile, brightness);
        if (loadGeoJSON) {
            this.loadGeoJSON = loadGeoJSON;
        }
        this._dynamicIndex = new GeoJSONRT();
    }

    /**
     * Fetches (if appropriate), parses, and index geojson data into tiles. This
     * preparatory method must be called before {@link GeoJSONWorkerSource#loadTile}
     * can correctly serve up tiles.
     *
     * Defers to {@link GeoJSONWorkerSource#loadGeoJSON} for the fetching/parsing,
     * expecting `callback(error, data)` to be called with either an error or a
     * parsed GeoJSON object.
     *
     * When `loadData` requests come in faster than they can be processed,
     * they are coalesced into a single request using the latest data.
     * See {@link GeoJSONWorkerSource#coalesce}
     *
     * @param params
     * @param callback
     * @private
     */
    loadData(params: LoadGeoJSONParameters, callback: Callback<{
        resourceTiming?: {
            [_: string]: Array<PerformanceResourceTiming>;
        };
    }>) {
        const requestParam = params && params.request;
        const perf = requestParam && requestParam.collectResourceTiming;

        this.loadGeoJSON(params, (err?: Error | null, data?: any | null) => {
            if (err || !data) {
                return callback(err);

            } else if (typeof data !== 'object') {
                return callback(new Error(`Input data given to '${params.source}' is not a valid GeoJSON object.`));

            } else {
                try {
                    if (params.filter) {
                        // @ts-expect-error - TS2353 - Object literal may only specify known properties, and 'overridable' does not exist in type '{ type: "boolean"; 'property-type': ExpressionType; expression?: ExpressionSpecification; transition?: boolean; default?: boolean; }'.
                        const compiled = createExpression(params.filter, {type: 'boolean', 'property-type': 'data-driven', overridable: false, transition: false});
                        if (compiled.result === 'error')
                            throw new Error(compiled.value.map(err => `${err.key}: ${err.message}`).join(', '));

                        data.features = data.features.filter(feature => compiled.value.evaluate({zoom: 0}, feature));
                    }

                    // for GeoJSON sources that are marked as dynamic, we retain the GeoJSON data
                    // as a id-to-feature map so that we can later update features by id individually
                    if (params.dynamic) {
                        if (data.type === 'Feature') data = {type: 'FeatureCollection', features: [data]};

                        if (!params.append) {
                            this._dynamicIndex.clear();
                            this.loaded = {};
                        }

                        this._dynamicIndex.load(data.features, this.loaded);

                        if (params.cluster) data.features = this._dynamicIndex.getFeatures();

                    } else {
                        this.loaded = {};
                    }

                    this._geoJSONIndex =
                        params.cluster ? new Supercluster(getSuperclusterOptions(params)).load(data.features) :
                        params.dynamic ? this._dynamicIndex :
                        geojsonvt(data, params.geojsonVtOptions);

                } catch (err: any) {
                    return callback(err);
                }

                const result: Record<string, any> = {};
                if (perf) {
                    const resourceTimingData = getPerformanceMeasurement(requestParam);
                    // it's necessary to eval the result of getEntriesByName() here via parse/stringify
                    // late evaluation in the main thread causes TypeError: illegal invocation
                    if (resourceTimingData) {
                        result.resourceTiming = {};
                        result.resourceTiming[params.source] = JSON.parse(JSON.stringify(resourceTimingData));
                    }
                }
                callback(null, result);
            }
        });
    }

    /**
    * Implements {@link WorkerSource#reloadTile}.
    *
    * If the tile is loaded, uses the implementation in VectorTileWorkerSource.
    * Otherwise, such as after a setData() call, we load the tile fresh.
    *
    * @param params
    * @param params.uid The UID for this tile.
    * @private
    */
    reloadTile(params: WorkerTileParameters, callback: WorkerTileCallback): void {
        const loaded = this.loaded,
            uid = params.uid;

        if (loaded && loaded[uid]) {
            if (params.partial) {
                return callback(null, undefined);
            }
            return super.reloadTile(params, callback);
        } else {
            return this.loadTile(params, callback);
        }
    }

    /**
     * Fetch and parse GeoJSON according to the given params.  Calls `callback`
     * with `(err, data)`, where `data` is a parsed GeoJSON object.
     *
     * GeoJSON is loaded and parsed from `params.url` if it exists, or else
     * expected as a literal (string or object) `params.data`.
     *
     * @param params
     * @param [params.url] A URL to the remote GeoJSON data.
     * @param [params.data] Literal GeoJSON data. Must be provided if `params.url` is not.
     * @private
     */
    loadGeoJSON(params: LoadGeoJSONParameters, callback: ResponseCallback<any>): void {
        // Because of same origin issues, urls must either include an explicit
        // origin or absolute path.
        // ie: /foo/bar.json or http://example.com/bar.json
        // but not ../foo/bar.json
        if (params.request) {
            getJSON(params.request, callback);
        } else if (typeof params.data === 'string') {
            try {
                return callback(null, JSON.parse(params.data));
            } catch (e: any) {
                return callback(new Error(`Input data given to '${params.source}' is not a valid GeoJSON object.`));
            }
        } else {
            return callback(new Error(`Input data given to '${params.source}' is not a valid GeoJSON object.`));
        }
    }

    getClusterExpansionZoom(params: {
        clusterId: number;
    }, callback: Callback<number>) {
        try {
            callback(null, this._geoJSONIndex.getClusterExpansionZoom(params.clusterId));
        } catch (e: any) {
            callback(e);
        }
    }

    getClusterChildren(params: {
        clusterId: number;
    }, callback: Callback<Array<GeoJSON.Feature>>) {
        try {
            callback(null, this._geoJSONIndex.getChildren(params.clusterId));
        } catch (e: any) {
            callback(e);
        }
    }

    getClusterLeaves(params: {
        clusterId: number;
        limit: number;
        offset: number;
    }, callback: Callback<Array<GeoJSON.Feature>>) {
        try {
            callback(null, this._geoJSONIndex.getLeaves(params.clusterId, params.limit, params.offset));
        } catch (e: any) {
            callback(e);
        }
    }
}

function getSuperclusterOptions({
    superclusterOptions,
    clusterProperties,
}: LoadGeoJSONParameters) {
    if (!clusterProperties || !superclusterOptions) return superclusterOptions;

    const mapExpressions: Record<string, any> = {};
    const reduceExpressions: Record<string, any> = {};
    const globals = {accumulated: null, zoom: 0};
    const feature = {properties: null};
    const propertyNames = Object.keys(clusterProperties);

    for (const key of propertyNames) {
        const [operator, mapExpression] = clusterProperties[key];

        const mapExpressionParsed = createExpression(mapExpression);
        const reduceExpressionParsed = createExpression(
            typeof operator === 'string' ? [operator, ['accumulated'], ['get', key]] : operator);

        assert(mapExpressionParsed.result === 'success');
        assert(reduceExpressionParsed.result === 'success');

        mapExpressions[key] = mapExpressionParsed.value;
        reduceExpressions[key] = reduceExpressionParsed.value;
    }

    superclusterOptions.map = (pointProperties) => {
        feature.properties = pointProperties;
        const properties: Record<string, any> = {};
        for (const key of propertyNames) {
            properties[key] = mapExpressions[key].evaluate(globals, feature);
        }
        return properties;
    };
    superclusterOptions.reduce = (accumulated, clusterProperties) => {
        feature.properties = clusterProperties;
        for (const key of propertyNames) {
            globals.accumulated = accumulated[key];
            accumulated[key] = reduceExpressions[key].evaluate(globals, feature);
        }
    };

    return superclusterOptions;
}

export default GeoJSONWorkerSource;
