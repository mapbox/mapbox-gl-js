import ValidationError from '../error/validation_error';
import validateString from './validate_string';

type GlyphsUrlValidatorOptions = {
    key: string;
    value: unknown;
};

export default function validateGlyphsUrl({key, value}: GlyphsUrlValidatorOptions): ValidationError[] {
    const errors = validateString({key, value});
    if (errors.length) return errors;

    const str = value as string;
    if (str.indexOf('{fontstack}') === -1) {
        errors.push(new ValidationError(key, value, '"glyphs" url must include a "{fontstack}" token'));
    }

    if (str.indexOf('{range}') === -1) {
        errors.push(new ValidationError(key, value, '"glyphs" url must include a "{range}" token'));
    }

    return errors;
}
