// @flow
import validate from './validate.js';
import latestStyleSpec from '../reference/latest.js';
import validateGlyphsURL from './validate_glyphs_url.js';

import ValidationError from '../error/validation_error.js';

import type {ValidationOptions} from './validate.js';
import type {StyleSpecification} from '../types.js';

type StyleValidationOptions = {
    key?: $PropertyType<ValidationOptions, 'key'>
}

export default function validateStyle(style: StyleSpecification, styleSpec: Object = latestStyleSpec, options: StyleValidationOptions = {}): ValidationError[] {
    const errors = validate({
        key: options.key || '',
        value: style,
        valueSpec: styleSpec.$root,
        styleSpec,
        style,
        objectElementValidators: {
            glyphs: validateGlyphsURL,
            '*': () => []
        }
    });

    return errors;
}
