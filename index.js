var reference = require('./reference');
exports.v6 = reference.v6;
exports.v7 = reference.v7;
exports.v8 = reference.v8;
exports.latest = reference.latest;
exports.v6min = reference.v6min;
exports.v7min = reference.v7min;
exports.v8min = reference.v8min;
exports.latestmin = reference.latestmin;

exports.format = require('./lib/format');
exports.migrate = require('./lib/migrate');
exports.composite = require('./lib/composite');
exports.diff = require('./lib/diff');
exports.ValidationError = require('./lib/validation_error');
exports.ParsingError = require('./lib/parsing_error');

exports.validate = require('./lib//validate/validate_style');
exports.validateSource = require('./lib/validate/validate_source');
exports.validateLayer = require('./lib/validate/validate_layer');
exports.validateFilter = require('./lib/validate/validate_filter');
exports.validatePaintProperty = require('./lib/validate/validate_paint_property');
exports.validateLayoutProperty = require('./lib/validate/validate_layout_property');

// TO BE DEPRECATED
exports.validate.parsed = require('./lib//validate/validate_style');
exports.validate.latest = require('./lib//validate/validate_style');
