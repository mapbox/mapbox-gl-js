import validate from './validate';
import latestStyleSpec from '../reference/latest';
import validateGlyphsURL from './validate_glyphs_url';

import type ValidationError from '../error/validation_error';
import type {StyleReference} from '../reference/latest';
import type {ValidationOptions} from './validate';
import type {StyleSpecification} from '../types';

type StyleValidationOptions = {
    key?: ValidationOptions['key'];
};

export default function validateStyle(
    style: StyleSpecification,
    styleSpec: StyleReference = latestStyleSpec,
    options: StyleValidationOptions = {},
): ValidationError[] {
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
