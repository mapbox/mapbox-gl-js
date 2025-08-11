import ValidationError from '../error/validation_error';
import {getType, isObject, isString} from '../util/get_type';
import validate from './validate';

import type {StyleReference} from '../reference/latest';
import type {StyleSpecification} from '../types';

type ProjectionValidatorOptions = {
    key: string;
    value: unknown;
    style: Partial<StyleSpecification>;
    styleSpec: StyleReference;
};

export default function validateProjection(options: ProjectionValidatorOptions): ValidationError[] {
    const projection = options.value;
    const styleSpec = options.styleSpec;
    const projectionSpec = styleSpec.projection;
    const style = options.style;

    if (isObject(projection)) {
        let errors: ValidationError[] = [];

        for (const key in projection) {
            errors = errors.concat(validate({
                key,
                value: projection[key],
                valueSpec: projectionSpec[key],
                style,
                styleSpec
            }));
        }

        return errors;
    }

    if (!isString(projection)) {
        return [new ValidationError('projection', projection, `object or string expected, ${getType(projection)} found`)];
    }

    return [];
}
