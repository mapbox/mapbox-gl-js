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

exports.validate = validateStyleWithInferredSpec;
exports.validate.parsed = validateStyleWithInferredSpec;
exports.validate.latest = require('./lib//validate/validate_style');

exports.validateSource = require('./lib/validate/validate_source');
exports.validateLayer = require('./lib/validate/validate_layer');
exports.validateFilter = require('./lib/validate/validate_filter');
exports.validatePaintProperty = require('./lib/validate/validate_paint_property');
exports.validateLayoutProperty = require('./lib/validate/validate_layout_property');

var validateStyle = require('./lib/validate/validate_style');
var parseStyle = require('./lib/parse_style');
function validateStyleWithInferredSpec(style, styleSpec) {
    var result;
    try {
        var style = parseStyle(style);
        return validateStyle(style, exports['v' + style.version]);
    } catch (e) {
        if (e instanceof exports.ParsingError) {
            return [e];
        } else {
            throw e;
        }
    }
}
