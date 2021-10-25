import ValidationError from '../error/validation_error.js';
import getType from '../util/get_type.js';
import validate from './validate.js';

export default function validateProjection(options) {
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
