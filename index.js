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
exports.composite = require('./lib/composite');
exports.diff = require('./lib/diff');
exports.ValidationError = require('./lib/error/validation_error');
exports.ParsingError = require('./lib/error/parsing_error');
exports.function = require('./lib/function');
exports.featureFilter = require('./lib/feature_filter');

exports.validate = require('./lib/validate_style');
exports.validate.parsed = require('./lib/validate_style');
exports.validate.latest = require('./lib/validate_style');
