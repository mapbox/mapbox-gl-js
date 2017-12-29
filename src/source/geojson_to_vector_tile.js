// @flow

const TileCoord = require('../source/tile_coord');
const geojsonvt = require('geojson-vt');
const EXTENT = require('../data/extent');
const supercluster = require('supercluster');
const GeoJSONWrapper = require('./geojson_wrapper');

module.exports = function(data: any, options: VectorSourceSpecification, tileSize: number, zoom: number, tileCoord: TileCoord) {
  const scale = EXTENT / tileSize;
  let index;

  if (options.cluster) {
      index = getSuperCluterIndex(data, options, zoom, scale);
  } else {
      index = getGeojsonVTIndex(data, options, zoom, scale);
  }
  const geoJSONTile = index.getTile(zoom, tileCoord.x, tileCoord.y);
  if (!geoJSONTile) {
      return null; // callback(null);
  }
  return new GeoJSONWrapper(geoJSONTile.features);
};

function getSuperCluterIndex(data: any, options: VectorSourceSpecification, zoom: number, scale: number) {
    const superclusterOptions = {
        // TODO: Work based on current zoom level.
        minZoom: zoom - 3,
        maxZoom: zoom + 3,
        extent: EXTENT,
        radius: (options.clusterRadius || 50) * scale
    };
    superclusterOptions.map = function(props) {
        return {sum: Number(props[options.aggregateBy]) || 1, sum_abbrev: 1};
    }
    superclusterOptions.reduce = function (accumulated, props) {
        var sum = accumulated.sum + props.sum;
        var abbrev = sum >= 10000 ? Math.round(sum / 1000) + 'k' :
        sum >= 1000 ? (Math.round(sum / 100) / 10) + 'k' : sum;

        accumulated.sum_abbrev = abbrev;
        accumulated.sum = sum;
    }
    superclusterOptions.initial = function () {
        return {sum: 0};
    }
    return supercluster(superclusterOptions).load(data.features);
}

function getGeojsonVTIndex(data: any, options: VectorSourceSpecification, zoom: number, scale: number) {
    const geojsonVtOptions = {
        buffer: (options.buffer !== undefined ? options.buffer : 128) * scale,
        tolerance: (options.tolerance !== undefined ? options.tolerance : 0.375) * scale,
        extent: EXTENT,
        // TODO: Work based on current zoom level.
        maxZoom: zoom
    }
    return geojsonvt(data, geojsonVtOptions);
}
