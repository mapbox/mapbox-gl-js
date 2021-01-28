// @flow
import validateStyleMin from '../style-spec/validate_style.min.js';
import {ErrorEvent} from '../util/evented.js';

import type {Evented} from '../util/evented.js';

type ValidationError = {
    message: string,
    line: number,
    identifier?: string
};

export type Validator = (Object) => $ReadOnlyArray<ValidationError>;

type ValidateStyle = {
    (Object, ?Object): $ReadOnlyArray<ValidationError>,
    source: Validator,
    layer: Validator,
    light: Validator,
    terrain: Validator,
    filter: Validator,
    paintProperty: Validator,
    layoutProperty: Validator
};

export const validateStyle = (validateStyleMin: ValidateStyle);

export const validateSource = validateStyle.source;
export const validateLight = validateStyle.light;
export const validateTerrain = validateStyle.terrain;
export const validateFilter = validateStyle.filter;
export const validatePaintProperty = validateStyle.paintProperty;
export const validateLayoutProperty = validateStyle.layoutProperty;

export function emitValidationErrors(emitter: Evented, errors: ?$ReadOnlyArray<{message: string, identifier?: string}>): boolean {
    let hasErrors = false;
    if (errors && errors.length) {
        for (const error of errors) {
            emitter.fire(new ErrorEvent(new Error(error.message)));
            hasErrors = true;
        }
    }
    return hasErrors;
}
