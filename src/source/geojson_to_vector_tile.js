// @flow

// We convert a geojson data to vector tile. All the stuff here are based on
// `geojson_worker_source.js` and `geojson_source.js`;
const EXTENT = require('../data/extent');
const geojsonvt = require('geojson-vt');
const GeoJSONWrapper = require('./geojson_wrapper');
const supercluster = require('supercluster');
const UnwrappedTileID = require('../source/tile_id');
const getSuperclusterOptions = require('../source/geojson_worker_source');
const util = require('../util/util');

module.exports = function(data: any, options: VectorSourceSpecification, tileSize: number, zoom: number, tileID: UnwrappedTileID) {
    const scale = EXTENT / tileSize;
    let index = null;
    let geoJSONTile;

    if (options.cluster) {
        index = getSuperCluterIndex(data, options, tileID.canonical.z, scale);
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

function getSuperCluterIndex(data: any, options: VectorSourceSpecification, zoom: number, scale: number) {
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
    return supercluster(superclusterOptions).load(data.features);
};
