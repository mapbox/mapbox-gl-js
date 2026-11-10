import {ErrorEvent} from '../util/evented';
import {warnOnce} from '../util/util';
import {ValidationWarning} from '../style-spec/error/validation_error';
import {DebugModule} from '../../modules/debug';

import type {ValidationErrors as _ValidationErrors} from '../style-spec/validate_style.min';

export type {Validator, ValidationError, ValidationErrors} from '../style-spec/validate_style.min';

export function emitValidationErrors(emitter: {fire: (event: ErrorEvent) => unknown}, errors?: _ValidationErrors | null): boolean {
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

// Validators are read from `DebugModule` lazily. On UMD/CDN `DebugModule` is populated at
// module-load. On ESM it's populated when `prepareDebug()` resolves; until
// then `pick()` returns a no-op validator. Callers that race ahead of the
// dev-chunk fetch skip validation for that one call — the common-case path
// (initial `setStyle`) awaits the chunk before validating, see Style#loadJSON.
const noop = () => [] as _ValidationErrors;
function pick<K extends keyof typeof DebugModule>(name: K): NonNullable<(typeof DebugModule)[K]> {
    // Bound at call time, not at module-load time, so it tracks `DebugModule` after
    // `prepareDebug()` populates it.
    return ((...args: unknown[]) => {
        const fn = DebugModule[name];
        return fn ? (fn as (...a: unknown[]) => unknown)(...args) : noop();
    }) as NonNullable<(typeof DebugModule)[K]>;
}

export const validateStyle = pick('validateStyle');
export const validateSource = pick('validateSource');
export const validateLight = pick('validateLight');
export const validateLights = pick('validateLights');
export const validateTerrain = pick('validateTerrain');
export const validateFog = pick('validateFog');
export const validateSnow = pick('validateSnow');
export const validateRain = pick('validateRain');
export const validateLayer = pick('validateLayer');
export const validateFilter = pick('validateFilter');
export const validatePaintProperty = pick('validatePaintProperty');
export const validateLayoutProperty = pick('validateLayoutProperty');
export const validateModel = pick('validateModel');
