'use strict';

var sources = {
    vector: require('./vector_tile_source'),
    raster: require('./raster_tile_source'),
    geojson: require('./geojson_source'),
    video: require('./video_source')
};

exports.create = function(source) {
    return new sources[source.type](source);
};
