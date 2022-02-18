// @flow

import ValidationError from '../error/validation_error.js';
import validateProperty from './validate_property.js';

import type {ValidationOptions} from './validate.js';

type Options = ValidationOptions & {
    objectKey: string;
    layerType: string;
}

export default function validateLayoutProperty(options: Options): Array<ValidationError> {
    return validateProperty(options, 'layout');
}
