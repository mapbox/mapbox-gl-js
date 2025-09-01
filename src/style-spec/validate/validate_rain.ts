import {default as ValidationError, ValidationWarning} from '../error/validation_error';
import validate from './validate';
import {getType, isObject} from '../util/get_type';

import type {StyleReference} from '../reference/latest';
import type {StyleSpecification} from '../types';

type RainValidatorOptions = {
    key: string;
    value: unknown;
    style: Partial<StyleSpecification>;
    styleSpec: StyleReference;
};

export default function validateRain(options: RainValidatorOptions): ValidationError[] {
    const rain = options.value;
    const style = options.style;
    const styleSpec = options.styleSpec;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const rainSpec = styleSpec.rain;

    if (rain === undefined) {
        return [];
    }

    if (!isObject(rain)) {
        return [new ValidationError('rain', rain, `object expected, ${getType(rain)} found`)];
    }

    let errors: ValidationError[] = [];
    for (const key in rain) {
        const transitionMatch = key.match(/^(.*)-transition$/);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (transitionMatch && rainSpec[transitionMatch[1]] && rainSpec[transitionMatch[1]].transition) {
            errors = errors.concat(validate({
                key,
                value: rain[key],
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                valueSpec: styleSpec.transition,
                style,
                styleSpec
            }));
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        } else if (rainSpec[key]) {
            errors = errors.concat(validate({
                key,
                value: rain[key],
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                valueSpec: rainSpec[key],
                style,
                styleSpec
            }));
        } else {
            errors = errors.concat([new ValidationWarning(key, rain[key], `unknown property "${key}"`)]);
        }
    }

    return errors;
}
