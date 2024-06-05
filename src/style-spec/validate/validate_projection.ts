import ValidationError from '../error/validation_error';
import getType from '../util/get_type';
import validate from './validate';

import type {ValidationOptions} from './validate';

export default function validateProjection(options: ValidationOptions): Array<ValidationError> {
    const projection = options.value;
    const styleSpec = options.styleSpec;
    const projectionSpec = styleSpec.projection;
    const style = options.style;

    let errors = [];

    const rootType = getType(projection);

    if (rootType === 'object') {
        for (const key in projection) {
            errors = errors.concat(validate({
                key,
                value: projection[key],
                valueSpec: projectionSpec[key],
                style,
                styleSpec
            }));
        }
    } else if (rootType !== 'string') {
        errors = errors.concat([new ValidationError('projection', projection, `object or string expected, ${rootType} found`)]);
    }

    return errors;
}
