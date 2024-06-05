import validateProperty from './validate_property';

import type ValidationError from '../error/validation_error';
import type {PropertyValidationOptions} from './validate_property';

export default function validatePaintProperty(options: PropertyValidationOptions): Array<ValidationError> {
    return validateProperty(options, 'paint');
}
