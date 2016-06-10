'use strict';
// TODO: This will be removed before merging.  It is here now to demonstrate
// how a *third-party* could provide a WorkerSource implementation using
// webworkify
var GeojsonWorkerSource = require('./geojson_worker_source');
module.exports = function (self) {
    self.registerWorkerSource('geojson', new GeojsonWorkerSource());
};
