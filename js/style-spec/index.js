'use strict';

exports.v6 = require('./reference/v6.json');
exports.v7 = require('./reference/v7.json');
exports.v8 = require('./reference/v8.json');
exports.latest = require('./reference/latest');

exports.v6min = require('./reference/v6.min.json');
exports.v7min = require('./reference/v7.min.json');
exports.v8min = require('./reference/v8.min.json');
exports.latestmin = require('./reference/latest.min');

exports.format = require('./format');
exports.migrate = require('./migrate');
exports.composite = require('./composite');
exports.diff = require('./diff');
exports.ValidationError = require('./error/validation_error');
exports.ParsingError = require('./error/parsing_error');
exports.function = require('./function');
exports.featureFilter = require('./feature_filter');

exports.validate = require('./validate_style');
exports.validate.parsed = require('./validate_style');
exports.validate.latest = require('./validate_style');
