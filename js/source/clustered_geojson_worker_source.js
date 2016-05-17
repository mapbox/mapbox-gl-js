'use strict';

var supercluster = require('supercluster');
var GeoJSONWorkerSource = require('./geojson_worker_base');

var workerSource = Object.create(GeoJSONWorkerSource);
workerSource.indexData = function (data, params, callback) {
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
    self.registerWorkerSource('geojson-clustered', workerSource);
};
