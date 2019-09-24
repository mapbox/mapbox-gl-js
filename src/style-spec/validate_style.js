
import validateStyleMin from './validate_style.min';
import {v8} from './style-spec';
import readStyle from './read_style';

/**
 * Validate a Mapbox GL style against the style specification.
 *
 * @private
 * @alias validate
 * @param {Object|String|Buffer} style The style to be validated. If a `String`
 *     or `Buffer` is provided, the returned errors will contain line numbers.
 * @param {Object} [styleSpec] The style specification to validate against.
 *     If omitted, the spec version is inferred from the stylesheet.
 * @param {Object} options
 * @param {boolean} [options.mapboxApiSupported] If true, assert that
 * style can be uploaded to the Mapbox Styles API.
 * @returns {Array<ValidationError|ParsingError>}
 * @example
 *   var validate = require('mapbox-gl-style-spec').validate;
 *   var style = fs.readFileSync('./style.json', 'utf8');
 *   var errors = validate(style);
 */

export default function validateStyle(style, styleSpec = v8, options) {
    try {
        style = readStyle(style);
    } catch (e) {
        return [e];
    }

    return validateStyleMin(style, styleSpec, options);
}

export const source = validateStyleMin.source;
export const light = validateStyleMin.light;
export const layer = validateStyleMin.layer;
export const filter = validateStyleMin.filter;
export const paintProperty = validateStyleMin.paintProperty;
export const layoutProperty = validateStyleMin.layoutProperty;
