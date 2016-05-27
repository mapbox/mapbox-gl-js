'use strict';
var GeojsonWorkerSource = require('./geojson_worker_base');
module.exports = function (self) {
    self.registerWorkerSource('geojson', Object.create(GeojsonWorkerSource));
};
