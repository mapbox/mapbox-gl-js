import {validateStyle as validateStyleMin} from './validate_style.min';
import {v8} from './style-spec';
import readStyle from './read_style';

import type {StyleReference} from './reference/latest';
import type {ValidationErrors} from './validate_style.min';
import type {StyleSpecification} from './types';

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

export default function validateStyle(style: StyleSpecification | string | Buffer, styleSpec: StyleReference = v8): ValidationErrors {
    let s = style;

    try {
        s = readStyle(s);
    } catch (e) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return [e];
    }

    return validateStyleMin(s, styleSpec);
}

export {
    validateSource as source,
    validateModel as model,
    validateLight as light,
    validateLayer as layer,
    validateFilter as filter,
    validateLights as lights,
    validateTerrain as terrain,
    validateFog as fog,
    validatePaintProperty as paintProperty,
    validateLayoutProperty as layoutProperty
} from './validate_style.min';
