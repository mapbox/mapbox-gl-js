exports.v6 = require('./reference/v6.json');
exports.v7 = require('./reference/v7.json');
exports.v8 = require('./reference/v8.json');
exports.latest = require('./reference/latest');

exports.v6min = require('./reference/v6.min.json');
exports.v7min = require('./reference/v7.min.json');
exports.v8min = require('./reference/v8.min.json');
exports.latestmin = require('./reference/latest.min');

exports.format = require('./lib/format');
exports.migrate = require('./lib/migrate');
exports.validate = require('./lib/validate');
exports.composite = require('./lib/composite');
exports.diff = require('./lib/diff');
