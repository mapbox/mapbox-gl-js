import latestStyleSpec from './reference/latest';
import _validateStyle from './validate/validate_style';
import _validateSource from './validate/validate_source';
import _validateLight from './validate/validate_light';
import _validateLights from './validate/validate_lights';
import _validateTerrain from './validate/validate_terrain';
import _validateFog from './validate/validate_fog';
import _validateSnow from './validate/validate_snow';
import _validateRain from './validate/validate_rain';
import _validateLayer from './validate/validate_layer';
import _validateFilter from './validate/validate_filter';
import _validatePaintProperty from './validate/validate_paint_property';
import _validateLayoutProperty from './validate/validate_layout_property';
import _validateModel from './validate/validate_model';

import type {StyleReference} from './reference/latest';
import type {StyleSpecification} from './types';

export type ValidationError = {
    message: string;
    identifier?: string | null | undefined;
    line?: number | null | undefined;
};

export type ValidationErrors = ReadonlyArray<ValidationError>;
export type Validator<T extends (...args: unknown[]) => unknown = (...args: unknown[]) => unknown> = (...args: Parameters<T>) => ValidationErrors;

/**
 * Validate a Mapbox GL style against the style specification. This entrypoint,
 * `mapbox-gl-style-spec/lib/validate_style.min`, is designed to produce as
 * small a browserify bundle as possible by omitting unnecessary functionality
 * and legacy style specifications.
 *
 * @private
 * @param {Object} style The style to be validated.
 * @param {Object} [styleSpec] The style specification to validate against.
 *     If omitted, the latest style spec is used.
 * @returns {Array<ValidationError>}
 * @example
 *   var validate = require('mapbox-gl-style-spec/lib/validate_style.min');
 *   var errors = validate(style);
 */
export function validateStyle(style: StyleSpecification, styleSpec: StyleReference = latestStyleSpec): ValidationErrors {
    const errors = _validateStyle(style, styleSpec);
    return sortErrors(errors);
}

export const validateSource: Validator<typeof _validateSource> = opts => sortErrors(_validateSource(opts));
export const validateLight: Validator<typeof _validateLight> = opts => sortErrors(_validateLight(opts));
export const validateLights: Validator<typeof _validateLights> = opts => sortErrors(_validateLights(opts));
export const validateTerrain: Validator<typeof _validateTerrain> = opts => sortErrors(_validateTerrain(opts));
export const validateFog: Validator<typeof _validateFog> = opts => sortErrors(_validateFog(opts));
export const validateSnow: Validator<typeof _validateSnow> = opts => sortErrors(_validateSnow(opts));
export const validateRain: Validator<typeof _validateRain> = opts => sortErrors(_validateRain(opts));
export const validateLayer: Validator<typeof _validateLayer> = opts => sortErrors(_validateLayer(opts));
export const validateFilter: Validator<typeof _validateFilter> = opts => sortErrors(_validateFilter(opts));
export const validatePaintProperty: Validator<typeof _validatePaintProperty> = opts => sortErrors(_validatePaintProperty(opts));
export const validateLayoutProperty: Validator<typeof _validateLayoutProperty> = opts => sortErrors(_validateLayoutProperty(opts));
export const validateModel: Validator<typeof _validateModel> = opts => sortErrors(_validateModel(opts));

function sortErrors(errors: ValidationErrors): ValidationErrors {
    return errors.slice().sort((a, b) => a.line && b.line ? a.line - b.line : 0);
}
