import validateObject from './validate_object';
import latestStyleSpec from '../reference/latest';
import validateGlyphsURL from './validate_glyphs_url';

import type ValidationError from '../error/validation_error';
import type {StyleReference} from '../reference/latest';
import type {StyleSpecification} from '../types';

type StyleValidatorOptions = {
    key?: string;
    /** Validate as a fragment, which may omit the properties its parent defines. */
    fragment?: boolean;
};

export default function validateStyle(style: unknown, styleSpec: StyleReference = latestStyleSpec, options: StyleValidatorOptions = {}): ValidationError[] {
    const root = style as Partial<StyleSpecification>;
    const errors = validateObject({
        key: options.key || '',
        value: style,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        valueSpec: {
            ...styleSpec.$root,
            // Skip validation of the root properties that are not defined in the style spec (e.g. 'owner').
            '*': {type: '*'},
        },
        styleSpec,
        style: options.fragment ? {...root, fragment: true} : root,
        objectElementValidators: {
            glyphs: validateGlyphsURL
        }
    });

    return errors;
}
