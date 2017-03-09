'use strict';

const validateStyleMin = require('./validate_style.min');
const ParsingError = require('./error/parsing_error');
const jsonlint = require('jsonlint-lines-primitives');

/**
 * Validate a Mapbox GL style against the style specification.
 *
 * @private
 * @alias validate
 * @param {Object|String|Buffer} style The style to be validated. If a `String`
 *     or `Buffer` is provided, the returned errors will contain line numbers.
 * @param {Object} [styleSpec] The style specification to validate against.
 *     If omitted, the spec version is inferred from the stylesheet.
 * @returns {Array<ValidationError|ParsingError>}
 * @example
 *   var validate = require('mapbox-gl-style-spec').validate;
 *   var style = fs.readFileSync('./style.json', 'utf8');
 *   var errors = validate(style);
 */

module.exports = function validateStyle(style, styleSpec) {
    const index = require('./');

    if (style instanceof String || typeof style === 'string' || style instanceof Buffer) {
        try {
            style = jsonlint.parse(style.toString());
        } catch (e) {
            return [new ParsingError(e)];
        }
    }

    styleSpec = styleSpec || index[`v${style.version}`];

    return validateStyleMin(style, styleSpec);
};

exports.source = validateStyleMin.source;
exports.light = validateStyleMin.light;
exports.layer = validateStyleMin.layer;
exports.filter = validateStyleMin.filter;
exports.paintProperty = validateStyleMin.paintProperty;
exports.layoutProperty = validateStyleMin.layoutProperty;
