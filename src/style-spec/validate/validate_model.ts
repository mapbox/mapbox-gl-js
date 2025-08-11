import ValidationError from '../error/validation_error';
import {getType, isString} from '../util/get_type';

import type {StyleReference} from '../reference/latest';
import type {StyleSpecification} from '../types';

// Allow any URL, use dummy base, if it's a relative URL
export function isValidUrl(str: string, allowRelativeUrls: boolean): boolean {
    const isRelative = str.indexOf('://') === -1;
    try {
        new URL(str, isRelative && allowRelativeUrls ? 'http://example.com' : undefined);
        return true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (_: any) {
        return false;
    }
}

type ModelValidatorOptions = {
    key: string;
    value: unknown;
    style: Partial<StyleSpecification>;
    styleSpec: StyleReference;
};

export default function validateModel(options: ModelValidatorOptions): ValidationError[] {
    const url = options.value;

    if (!url) {
        return [];
    }

    if (!isString(url)) {
        return [new ValidationError(options.key, url, `string expected, "${getType(url)}" found`)];
    }

    if (!isValidUrl(url, true)) {
        return [new ValidationError(options.key, url, `invalid url "${url}"`)];
    }

    return [];
}
