'use strict';
var GeojsonWorker = require('./geojson_source_worker');
module.exports = function (self) {
    self.registerPlugin('geojson', Object.create(GeojsonWorker));
};
