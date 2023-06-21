// @flow

import extend from '../util/extend.js';
import ValidationError from '../error/validation_error.js';
import {unbundle, deepUnbundle} from '../util/unbundle_jsonlint.js';
import {isExpression} from '../expression/index.js';
import {isFunction} from '../function/index.js';

import validateImport from './validate_import.js';
import validateFunction from './validate_function.js';
import validateExpression from './validate_expression.js';
import validateObject from './validate_object.js';
import validateArray from './validate_array.js';
import validateBoolean from './validate_boolean.js';
import validateNumber from './validate_number.js';
import validateColor from './validate_color.js';
import validateEnum from './validate_enum.js';
import validateFilter from './validate_filter.js';
import validateLayer from './validate_layer.js';
import validateSource from './validate_source.js';
import validateModel from './validate_model.js';
import validateLight from './validate_light.js';
import validateLights from './validate_lights.js';
import validateTerrain from './validate_terrain.js';
import validateFog from './validate_fog.js';
import validateString from './validate_string.js';
import validateFormatted from './validate_formatted.js';
import validateImage from './validate_image.js';
import validateProjection from './validate_projection.js';

import type {StyleReference} from '../reference/latest.js';
import type {StyleSpecification} from '../types.js';
import getType from '../util/get_type.js';

const VALIDATORS = {
    '*'() {
        return [];
    },
    'array': validateArray,
    'boolean': validateBoolean,
    'number': validateNumber,
    'color': validateColor,
    'enum': validateEnum,
    'filter': validateFilter,
    'function': validateFunction,
    'layer': validateLayer,
    'object': validateObject,
    'source': validateSource,
    'model': validateModel,
    'light': validateLight,
    'light-3d': validateLights,
    'terrain': validateTerrain,
    'fog': validateFog,
    'string': validateString,
    'formatted': validateFormatted,
    'resolvedImage': validateImage,
    'projection': validateProjection,
    'import': validateImport
};

// Main recursive validation function. Tracks:
//
// - key: string representing location of validation in style tree. Used only
//   for more informative error reporting.
// - value: current value from style being evaluated. May be anything from a
//   high level object that needs to be descended into deeper or a simple
//   scalar value.
// - valueSpec: current spec being evaluated. Tracks value.
// - styleSpec: current full spec being evaluated.
export type ValidationOptions = {
    key: string;
    value: Object;
    valueSpec: Object;
    style: $Shape<StyleSpecification>;
    styleSpec: StyleReference;
}

export default function validate(options: ValidationOptions, arrayAsExpression: boolean = false): Array<ValidationError> {
    const value = options.value;
    const valueSpec = options.valueSpec;
    const styleSpec = options.styleSpec;

    if (valueSpec.expression && isFunction(unbundle(value))) {
        return validateFunction(options);
    } else if (valueSpec.expression && isExpression(deepUnbundle(value))) {
        return validateExpression(options);
    } else if (valueSpec.type && VALIDATORS[valueSpec.type]) {
        const valid = VALIDATORS[valueSpec.type](options);
        if (arrayAsExpression === true && valid.length > 0 && getType(options.value) === "array") {
            // Try to validate as an expression
            return validateExpression(options);
        } else {
            return valid;
        }
    } else {
        const valid = validateObject(extend({}, options, {
            valueSpec: valueSpec.type ? styleSpec[valueSpec.type] : valueSpec
        }));
        return valid;
    }
}
