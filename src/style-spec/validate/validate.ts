import extend from '../util/extend';
import {unbundle, deepUnbundle} from '../util/unbundle_jsonlint';
import {isExpression} from '../expression/index';
import {isFunction} from '../function/index';
import validateImport from './validate_import';
import validateFunction from './validate_function';
import validateExpression from './validate_expression';
import validateObject from './validate_object';
import validateArray from './validate_array';
import validateBoolean from './validate_boolean';
import validateNumber from './validate_number';
import validateColor from './validate_color';
import validateEnum from './validate_enum';
import validateFilter from './validate_filter';
import validateLayer from './validate_layer';
import validateSource from './validate_source';
import validateModel from './validate_model';
import validateLight from './validate_light';
import validateLights from './validate_lights';
import validateTerrain from './validate_terrain';
import validateFog from './validate_fog';
import validateString from './validate_string';
import validateFormatted from './validate_formatted';
import validateImage from './validate_image';
import validateProjection from './validate_projection';
import getType from '../util/get_type';

import type {StyleReference} from '../reference/latest';
import type {StyleSpecification} from '../types';
import type ValidationError from '../error/validation_error';

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
    value: any;
    valueSpec?: any;
    style: Partial<StyleSpecification>;
    styleSpec: StyleReference;
};

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
