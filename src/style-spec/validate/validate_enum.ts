import ValidationError from '../error/validation_error';
import {unbundle} from '../util/unbundle_jsonlint';

import type {StyleReference} from '../reference/latest';
import type {StyleSpecification} from '../types';

type EnumValidatorOptions = {
    key: string;
    value: unknown;
    valueSpec?: {
        values: unknown[];
    };
    style?: Partial<StyleSpecification>;
    styleSpec?: StyleReference;
};

export default function validateEnum(options: EnumValidatorOptions): ValidationError[] {
    const key = options.key;
    const value = options.value;
    const valueSpec = options.valueSpec;

    const errors: ValidationError[] = [];
    if (Array.isArray(valueSpec.values)) { // <=v7
        if (valueSpec.values.indexOf(unbundle(value)) === -1) {
            // eslint-disable-next-line @typescript-eslint/no-base-to-string
            errors.push(new ValidationError(key, value, `expected one of [${valueSpec.values.join(', ')}], ${JSON.stringify(value)} found`));
        }
    } else { // >=v8
        if (Object.keys(valueSpec.values).indexOf(unbundle(value) as string) === -1) {
            errors.push(new ValidationError(key, value, `expected one of [${Object.keys(valueSpec.values).join(', ')}], ${JSON.stringify(value)} found`));
        }
    }

    return errors;
}
