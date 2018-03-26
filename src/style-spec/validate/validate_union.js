
import ValidationError from '../error/validation_error';
import getType from '../util/get_type';

export default function validateUnion(options) {
    const key = options.key;
    const value = options.value;
    const valueSpec = options.valueSpec;
    const errors = [];

    const type = getType(value);

    if (Object.keys(valueSpec.types).indexOf(type) === -1) {
        errors.push(new ValidationError(key, value, `expected one of types [${Object.keys(valueSpec.types).join(', ')}], ${JSON.stringify(type)} found`));
    }

    return errors;
}
