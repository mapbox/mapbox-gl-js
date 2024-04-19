// @flow

import ValidationError from '../error/validation_error.js';
import getType from '../util/get_type.js';

import type {ValidationOptions} from './validate.js';

// Allow any URL, use dummy base, if it's a relative URL
export function isValidUrl(str: string, allowRelativeUrls: boolean): boolean {
    const isRelative = str.indexOf('://') === -1;
    try {
        new URL(str, isRelative && allowRelativeUrls ? 'http://example.com' : undefined);
        return true;
    } catch (_) {
        return false;
    }
}

export default function validateModel(options: ValidationOptions): Array<ValidationError> {
    const url = options.value;
    let errors = [];

    if (!url) {
        return errors;
    }

    const type = getType(url);
    if (type !== 'string') {
        errors = errors.concat([new ValidationError(options.key, url, `string expected, "${type}" found`)]);
        return errors;
    }

    if (!isValidUrl(url, true)) {
        errors = errors.concat([new ValidationError(options.key, url, `invalid url "${url}"`)]);
    }

    return errors;
}
