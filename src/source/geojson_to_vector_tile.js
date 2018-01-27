// @flow

const EXTENT = require('../data/extent');
const geojsonvt = require('geojson-vt');
const GeoJSONWrapper = require('./geojson_wrapper');
const supercluster = require('supercluster');
const superclusterUtil = require('../util/superclusterUtil');
const TileCoord = require('../source/tile_coord');
const util = require('../util/util');

module.exports = function(data: any, options: VectorSourceSpecification, tileSize: number, zoom: number, tileCoord: TileCoord) {
    const scale = EXTENT / tileSize;
    const aggregateByKeys = superclusterUtil.sanitizedAggregateByKeys(options);
    let index;

    if (data && data.features && data.features.forEach && options.aggregateBy) {
        data.features.forEach((datum) => {
            if (datum && datum.properties) {
                aggregateByKeys.forEach((aggregateBy) => {
                    const value =  Number(datum.properties[aggregateBy]);
                    datum.properties[aggregateBy] = value;
                    datum.properties[`${aggregateBy}_abbrev`] = superclusterUtil.abbreviate(value);
                });
            }
        });
    }

    if (options.cluster) {
        index = getSuperCluterIndex(data, options, zoom, scale);
    } else {
        index = getGeojsonVTIndex(data, options, zoom, scale);
    }
    const geoJSONTile = index.getTile(zoom, tileCoord.x, tileCoord.y);
    if (!geoJSONTile) {
        return new GeoJSONWrapper([]);
    }
    return new GeoJSONWrapper(geoJSONTile.features);
};

function getSuperCluterIndex(data: any, options: VectorSourceSpecification, zoom: number, scale: number) {
    const superclusterOptions = util.extend({
        // TO-DO: Work based on current zoom level.
        minZoom: zoom - 3,
        maxZoom: zoom + 3,
        extent: EXTENT,
        radius: (options.clusterRadius || 50) * scale
    }, superclusterUtil.getMapReduceParams(options));

    return supercluster(superclusterOptions).load(data.features);
}

function getGeojsonVTIndex(data: any, options: VectorSourceSpecification, zoom: number, scale: number) {
    const geojsonVtOptions = {
        buffer: (options.buffer !== undefined ? options.buffer : 128) * scale,
        tolerance: (options.tolerance !== undefined ? options.tolerance : 0.375) * scale,
        extent: EXTENT,
        // TO-DO: Work based on current zoom level.
        maxZoom: zoom
    };
    return geojsonvt(data, geojsonVtOptions);
}
