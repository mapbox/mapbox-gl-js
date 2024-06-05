import {ErrorEvent} from '../util/evented';
import {warnOnce} from '../util/util';
import {ValidationWarning} from '../style-spec/error/validation_error';

import type {Evented} from '../util/evented';
import type {ValidationErrors as _ValidationErrors} from '../style-spec/validate_style.min';

export type {Validator, ValidationErrors} from '../style-spec/validate_style.min';

export function emitValidationErrors(emitter: Evented, errors?: _ValidationErrors | null): boolean {
    let hasErrors = false;
    if (errors && errors.length) {
        for (const error of errors) {
            // do not fail rendering when seeing unknown properties, just skip them
            if (error instanceof ValidationWarning) {
                warnOnce(error.message);
            } else {
                emitter.fire(new ErrorEvent(new Error(error.message)));
                hasErrors = true;
            }
        }
    }
    return hasErrors;
}

export {
    validateStyle,
    validateSource,
    validateLight,
    validateTerrain,
    validateLights,
    validateModel,
    validateFog,
    validateLayer,
    validateFilter,
    validatePaintProperty,
    validateLayoutProperty
} from '../style-spec/validate_style.min';
