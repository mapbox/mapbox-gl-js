import validateObject from './validate_object';
import latestStyleSpec from '../reference/latest';
import validateGlyphsURL from './validate_glyphs_url';

import type ValidationError from '../error/validation_error';
import type {StyleReference} from '../reference/latest';

type StyleValidatorOptions = {
    key?: string;
};

export default function validateStyle(style: unknown, styleSpec: StyleReference = latestStyleSpec, options: StyleValidatorOptions = {}): ValidationError[] {
    const errors = validateObject({
        key: options.key || '',
        value: style,
        valueSpec: Object.assign(
            styleSpec.$root,
            // Skip validation of the root properties that are not defined in the style spec (e.g. 'owner').
            {'*': {type: '*'}},
        ),
        styleSpec,
        style,
        objectElementValidators: {
            glyphs: validateGlyphsURL
        }
    });

    return errors;
}
