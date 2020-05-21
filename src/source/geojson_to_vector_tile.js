// @flow

// GeojsonSource/GeojsonWorkerSource
//    gets a single geojson data. For each tileData call, it slices and
//    returns the data for the given tile.
// VectorTileSource/VectorTileWorkerSource
//    retrieves mapbox vector pbf tile data for each tile via ajax.
//
// This: Geojson With Cluster + Per Tile calls
//
// The `loadGeojsonTileAsVectorTile` is hooked into VectorTileWorkerSource, based on `geojsonTile` option.
// Based on the logic in GeojsonWorker/Source, we make separate tile calls for each tile (simillar to
// vectorTileSource/Worker) but on top of it:
// 1. convert received geojson data to vector data format
// 2. `cluster`: true, we cluster the points using `Supercluster` library.

import vtpbf from 'vt-pbf';
import rewind from '@mapbox/geojson-rewind';
import Supercluster from 'supercluster';
import geojsonvt from 'geojson-vt';
import EXTENT from '../data/extent';
import GeoJSONWrapper from './geojson_wrapper';
import { getSuperclusterOptions } from './superclusterOptions';
import { getJSON } from '../util/ajax';

import type {WorkerTileParameters} from '../source/worker_source';
import type {LoadVectorDataCallback} from './vector_tile_worker_source';
import type {UnwrappedTileID} from '../source/tile_id';

export function loadGeojsonTileAsVectorTile(params: WorkerTileParameters, callback: LoadVectorDataCallback) {
    const options = params.options || {};
    const request = getJSON(params.request, (err: ?Error, data: ?ArrayBuffer, cacheControl: ?string, expires: ?string) => {
        if (err || !data) {
            return callback(err);
        } else if (typeof data !== 'object') {
            return callback(new Error("Input data is not a valid GeoJSON object."));
        } else {
            rewind(data, true);

            try {
                const { geojsonWrappedVectorTile, geojsonIndex } = geojsonToVectorTile(data, params);
                let pbf = vtpbf(geojsonWrappedVectorTile);
                if (pbf.byteOffset !== 0 || pbf.byteLength !== pbf.buffer.byteLength) {
                    // Compatibility with node Buffer (https://github.com/mapbox/pbf/issues/35)
                    pbf = new Uint8Array(pbf);
                }
                callback(null, {
                    vectorTile: geojsonWrappedVectorTile,
                    rawData: pbf.buffer,
                    cacheControl,
                    expires,
                    geojsonIndex: geojsonIndex
                });
            } catch (err) {
                return callback(err);
            }
        }
    });

    return request;
}

function geojsonToVectorTile(data: any, params: WorkerTileParameter) {
    const { options, tileID, tileSize, zoom } = params;
    const scale = EXTENT / tileSize;
    let index = null;
    let geoJSONTile;

    if (options.cluster) {
        // We cluster only for the tile's zoom level using super cluster and not for all zoom levels.
        // Since for other zoom levels, new tile calls will be made. This supercluster index will be
        // used only for the given tile.
        const superclusterOptions = getSuperclusterOptions({
            superclusterOptions: {
                minZoom: zoom,
                maxZoom: zoom,
                extent: EXTENT,
                radius: (options.clusterRadius || 50) * scale,
                log: false
            },
            clusterProperties: options.clusterProperties
        });
        index = new Supercluster(superclusterOptions).load(data.features);
        geoJSONTile = index.getTile(zoom, tileID.canonical.x, tileID.canonical.y);
    } else {
        geoJSONTile = {
          features: data
        };
    }

    const geojsonWrappedVectorTile = new GeoJSONWrapper(geoJSONTile ? geoJSONTile.features : []);
    return {
      geojsonWrappedVectorTile,
      geojsonIndex: index
    };
};
