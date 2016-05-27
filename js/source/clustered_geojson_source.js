'use strict';

var GeoJSONSource = require('./geojson_source');
var webworkify = require('webworkify');

module.exports.create = GeoJSONSource.create;
module.exports.workerSourceURL = URL.createObjectURL(
    webworkify(require('./clustered_geojson_worker_source'), {bare: true})
);

