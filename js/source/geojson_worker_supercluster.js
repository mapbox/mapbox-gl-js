'use strict';

var supercluster = require('supercluster');
var GeojsonWorker = require('./geojson_source_worker');

var plugin = Object.create(GeojsonWorker);
plugin.indexData = function (data, params, callback) {
    var superclusterOptions = {
        maxZoom: params.maxZoom,
        extent: params.extent,
        radius: (params.clusterRadius || 50) * params.scale,
        log: false
    };
    try {
        return callback(null, supercluster(superclusterOptions).load(data.features));
    } catch (e) {
        return callback(e);
    }
};

module.exports = function (self) {
    self.registerPlugin('cluster', plugin);
};
