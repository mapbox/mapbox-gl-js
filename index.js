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
exports.ValidationError = require('./lib/validation_error');
exports.ParsingError = require('./lib/parsing_error');

exports.validateSource = require('./lib/validate/validate_source');
exports.validateLayer = require('./lib/validate/validate_layer');
exports.validateFilter = require('./lib/validate/validate_filter');
exports.validatePaintProperty = require('./lib/validate/validate_paint_property');
exports.validateLayoutProperty = require('./lib/validate/validate_layout_property');

exports.validate.latest = require('./lib//validate/validate_style');

var validateStyle = require('./lib/validate/validate_style');
var validateStyle = require('./lib/parse_style');
exports.validate = exports.validate.parsed = function(style, styleSpec) {
    var result;
    try {
        var style = parseStyle(style);
        result = validate(style, styleSpec || exports['v' + style.version]);
    } catch (e) {
        if (e instanceof ParsingError) {
            result = [e];
        } else {
            throw e;
        }
    }
}
