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
import validateIconset from './validate_iconset';

import type ValidationError from '../error/validation_error';
import type {StyleReference} from '../reference/latest';
import type {StyleSpecification} from '../types';
import type {FunctionValidatorOptions} from './validate_function';
import type {ExpressionValidatorOptions} from './validate_expression';

const VALIDATORS: Record<string, (...args: unknown[]) => ValidationError[]> = {
    '*': () => [],
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
    'import': validateImport,
    'iconset': validateIconset,
};

export type ValidatorOptions = {
    /**
     * String representing location of validation in style tree. Used only
     * for more informative error reporting.
     */
    key: string;

    /**
     * Current value from style being evaluated. May be anything from a
     * high level object that needs to be descended into deeper or a simple
     * scalar value.
     */
    value: unknown;

    /**
     * Current spec being evaluated. Tracks value.
     */
    valueSpec?: {
        type?: string;
        expression?: {
            interpolated?: boolean;
            parameters?: Array<'zoom' | 'feature'>;
        };
        'property-type'?: 'data-driven';
    };

    /**
     * Current full spec being evaluated.
     */
    styleSpec: StyleReference;

    /**
     * Current style being validated.
     */
    style: Partial<StyleSpecification>;

    object?: object;
    objectKey?: string;
    propertyKey?: string;
    propertyType?: string;
    expressionContext?: string;
};

/**
 * Main recursive validation function.
 */
export default function validate(options: ValidatorOptions, arrayAsExpression: boolean = false): ValidationError[] {
    const value = options.value;
    const valueSpec = options.valueSpec;
    const styleSpec = options.styleSpec;

    if (valueSpec.expression) {
        if (isFunction(unbundle(value))) return validateFunction(options as unknown as FunctionValidatorOptions);
        if (isExpression(deepUnbundle(value))) return validateExpression(options as unknown as ExpressionValidatorOptions);
    }

    if (valueSpec.type && VALIDATORS[valueSpec.type]) {
        const errors = VALIDATORS[valueSpec.type](options);
        if (arrayAsExpression === true && errors.length > 0 && Array.isArray(options.value)) {
            // Try to validate as an expression
            return validateExpression(options as unknown as ExpressionValidatorOptions);
        }

        return errors;
    }

    const errors = validateObject(Object.assign({}, options, {
        valueSpec: valueSpec.type ? styleSpec[valueSpec.type] : valueSpec
    }));

    return errors;
}
