'use strict';

var util = require('../util/util');
var GeojsonSource = require('./geojson_source');
var webworkify = require('webworkify');

module.exports = ClusterSource;
module.exports.worker = URL.createObjectURL(webworkify(require('./geojson_worker_supercluster'), {bare: true}));

function ClusterSource (options) {
    GeojsonSource.call(this, options);
}
ClusterSource.prototype = util.inherit(GeojsonSource);
