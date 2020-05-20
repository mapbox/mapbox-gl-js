// @flow

// We convert a geojson data to vector tile. All the stuff here are based on
// `geojson_worker_source.js` and `geojson_source.js`;
import Supercluster from 'supercluster';
import geojsonvt from 'geojson-vt';
import EXTENT from '../data/extent';
import GeoJSONWrapper from './geojson_wrapper';
import { getSuperclusterOptions } from '../util/superclusterUtil';

import type {VectorSourceSpecification} from '../style-spec/types';
import type {UnwrappedTileID} from '../source/tile_id';

export default function(data: any, options: VectorSourceSpecification, tileSize: number, zoom: number, tileID: UnwrappedTileID) {
    const scale = EXTENT / tileSize;
    let index = null;
    let geoJSONTile;

    if (options.cluster) {
        index = getSuperClusterIndex(data, options, tileID.canonical.z, scale);
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

function getSuperClusterIndex(data: any, options: VectorSourceSpecification, zoom: number, scale: number) {
    // Since on zoom a new tile gets loaded, we do not need super cluster to index the data of the
    // given tile(x,y,z) for all zoom levels.
    // We index them for a couple of zoom levels, so that while zooming before data for new tile loads,
    // old tile of old zoom level shows on the map for the new zoom level.
    const superclusterOptions = getSuperclusterOptions({
        superclusterOptions: {
            minZoom: zoom - 3,
            maxZoom: zoom + 3,
            extent: EXTENT,
            radius: (options.clusterRadius || 50) * scale,
            log: false
        },
        clusterProperties: options.clusterProperties
    });
    return Supercluster(superclusterOptions).load(data.features);
};
