import validateMapboxApiSupported from './validate/validate_mapbox_api_supported';
import validateStyle from './validate_style.min';
import {v8} from './style-spec';
import readStyle from './read_style';

/**
 * Validate a Mapbox GL style against the style specification and against the
 * Mapbox Styles API validator.
 *
 * @alias validateMapboxApiSupported
 * @param {Object} style The style to be validated.
 * @returns {Array<ValidationError>}
 * @example
 *   var validateMapboxApiSupported = require('mapbox-gl-style-spec/lib/validate_style_mapbox_api_supported.js');
 *   var errors = validateMapboxApiSupported(style);
 */
export default function validateStyleMapboxApiSupported(style) {
    try {
        style = readStyle(style);
    } catch (e) {
        return [e];
    }

    return validateStyle(style, v8)
        .concat(validateMapboxApiSupported(style, v8));
}
