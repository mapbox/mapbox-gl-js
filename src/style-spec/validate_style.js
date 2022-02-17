// @flow
import {validateStyle as validateStyleMin} from './validate_style.min.js';
import {v8} from './style-spec.js';
import readStyle from './read_style.js';

import type {ValidationErrors} from './validate_style.min.js';
import type {StyleSpecification} from './types.js';

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

export default function validateStyle(style: StyleSpecification | string | Buffer, styleSpec: Object = v8): ValidationErrors {
    let s = style;

    try {
        s = readStyle(s);
    } catch (e) {
        return [e];
    }

    return validateStyleMin(s, styleSpec);
}

export {
    validateSource as source,
    validateLight as light,
    validateLayer as layer,
    validateFilter as filter,
    validatePaintProperty as paintProperty,
    validateLayoutProperty as layoutProperty
} from './validate_style.min.js';
