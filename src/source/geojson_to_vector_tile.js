// @flow

const TileCoord = require('../source/tile_coord');
const geojsonvt = require('geojson-vt');
const EXTENT = require('../data/extent');
const supercluster = require('supercluster');
const GeoJSONWrapper = require('./geojson_wrapper');

module.exports = function(data: any, options: VectorSourceSpecification, tileSize: number, zoom: number, tileCoord: TileCoord) {
  const scale = EXTENT / tileSize;
  const aggregateByKeys = sanitizedAggregateByKeys(options);
  let index;

  if (data && data.features && data.features.forEach && options.aggregateBy) {
    data.features.forEach((datum) => {
      if (datum && datum.properties) {
        aggregateByKeys.forEach((aggregateBy) => {
          const value =  Number(datum.properties[aggregateBy])
          datum.properties[aggregateBy] = value;
          datum.properties[aggregateBy + '_abbrev'] = abbreviate(value);
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
    const superclusterOptions = {
        // TODO: Work based on current zoom level.
        minZoom: zoom - 3,
        maxZoom: zoom + 3,
        extent: EXTENT,
        radius: (options.clusterRadius || 50) * scale
    };
    const aggregateByKeys = sanitizedAggregateByKeys(options);

    superclusterOptions.map = function(props) {
        const mapped = {};
        aggregateByKeys.forEach((aggregateBy) => {
            const value = Number(props[aggregateBy]) || 0;

            mapped[aggregateBy] = value;
            mapped[aggregateBy + '_abbrev'] = abbreviate(value);
        });
        return mapped;
    }
    superclusterOptions.reduce = function (accumulated, props) {
        aggregateByKeys.forEach((aggregateBy) => {
            const value = Number(props[aggregateBy]) || 0;
            const aggregate = accumulated[aggregateBy] + value;

            accumulated[aggregateBy] = aggregate;
            accumulated[aggregateBy + '_abbrev'] = abbreviate(aggregate);
        });
    }
    superclusterOptions.initial = function () {
        const initial = {};
        aggregateByKeys.forEach((aggregateBy) => {
            initial[aggregateBy] = 0;
            initial[aggregateBy + '_abbrev'] = '0';
        });
        return initial;
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

const MILLION = 1000000;
const HUNDRED_K = 100000;

function abbreviate(value) {
  return value >= 10 * MILLION ? Math.round(value / MILLION) + 'm' :
        value >= MILLION ? (Math.round(value / HUNDRED_K) / 10) + 'm' :
        value >= 10000 ? Math.round(value / 1000) + 'k' :
        value >= 1000 ? (Math.round(value / 100) / 10) + 'k' : value;
}

function sanitizedAggregateByKeys(options: VectorSourceSpecification) {
    let aggregateByKeys = [];
    if (options.aggregateBy) {
        aggregateByKeys = Array.isArray(options.aggregateBy) ? options.aggregateBy : [options.aggregateBy];
    }
    return aggregateByKeys;
}
