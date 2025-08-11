import validateProperty from './validate_property';

import type ValidationError from '../error/validation_error';
import type {PropertyValidatorOptions} from './validate_property';

export default function validateLayoutProperty(options: PropertyValidatorOptions): ValidationError[] {
    return validateProperty(options, 'layout');
}
