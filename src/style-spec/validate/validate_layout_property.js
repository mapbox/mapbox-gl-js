// @flow

import validateProperty from './validate_property.js';

import type ValidationError from '../error/validation_error.js';
import type {PropertyValidationOptions} from './validate_property.js';

export default function validateLayoutProperty(options: PropertyValidationOptions): Array<ValidationError> {
    return validateProperty(options, 'layout');
}
