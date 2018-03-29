// @flow
import validateStyleMin from '../style-spec/validate_style.min';
import { ErrorEvent, WarningEvent } from '../util/evented';
import { ValidationWarning } from '../style-spec/error/validation_error';

import type {Evented} from '../util/evented';

type ValidationError = {
    message: string,
    line: number
};

type Validator = (Object) => $ReadOnlyArray<ValidationError>;

export const validateStyle = (validateStyleMin: (Object, ?Object) => $ReadOnlyArray<ValidationError>);

export const validateSource = (validateStyleMin.source: Validator);
export const validateLight = (validateStyleMin.light: Validator);
export const validateFilter = (validateStyleMin.filter: Validator);
export const validatePaintProperty = (validateStyleMin.paintProperty: Validator);
export const validateLayoutProperty = (validateStyleMin.layoutProperty: Validator);

export function emitValidationErrors(emitter: Evented, errors: ?$ReadOnlyArray<{message: string}>): boolean {
    let hasErrors = false;
    if (errors && errors.length) {
        for (const error of errors) {
            const {message} = error;
            if (error instanceof ValidationWarning) {
                emitter.fire(new WarningEvent({warning: message}));
            } else {
                emitter.fire(new ErrorEvent(new Error(message)));
                hasErrors = true;
            }
        }
    }
    return hasErrors;
}
