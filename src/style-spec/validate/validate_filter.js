// @flow

import ValidationError from '../error/validation_error.js';
import validateExpression from './validate_expression.js';
import validateEnum from './validate_enum.js';
import getType from '../util/get_type.js';
import {unbundle, deepUnbundle} from '../util/unbundle_jsonlint.js';
import extend from '../util/extend.js';
import {isExpressionFilter} from '../feature_filter/index.js';

import type {ValidationOptions} from './validate.js';

type Options = ValidationOptions & {
    layerType?: string;
}

export default function validateFilter(options: Options): Array<ValidationError> {
    if (isExpressionFilter(deepUnbundle(options.value))) {
        // We default to a layerType of `fill` because that points to a non-dynamic filter definition within the style-spec.
        const layerType = options.layerType || 'fill';

        return validateExpression(extend({}, options, {
            expressionContext: 'filter',
            valueSpec: options.styleSpec[`filter_${layerType}`]
        }));
    } else {
        return validateNonExpressionFilter(options);
    }
}

function validateNonExpressionFilter(options: Options) {
    const value = options.value;
    const key = options.key;

    if (getType(value) !== 'array') {
        return [new ValidationError(key, value, `array expected, ${getType(value)} found`)];
    }

    const styleSpec = options.styleSpec;
    let type;

    let errors = [];

    if (value.length < 1) {
        return [new ValidationError(key, value, 'filter array must have at least 1 element')];
    }

    errors = errors.concat(validateEnum({
        key: `${key}[0]`,
        value: value[0],
        valueSpec: styleSpec.filter_operator,
        style: options.style,
        styleSpec: options.styleSpec
    }));

    switch (unbundle(value[0])) {
    case '<':
    case '<=':
    case '>':
    case '>=':
        if (value.length >= 2 && unbundle(value[1]) === '$type') {
            errors.push(new ValidationError(key, value, `"$type" cannot be use with operator "${value[0]}"`));
        }
        /* falls through */
    case '==':
    case '!=':
        if (value.length !== 3) {
            errors.push(new ValidationError(key, value, `filter array for operator "${value[0]}" must have 3 elements`));
        }
        /* falls through */
    case 'in':
    case '!in':
        if (value.length >= 2) {
            type = getType(value[1]);
            if (type !== 'string') {
                errors.push(new ValidationError(`${key}[1]`, value[1], `string expected, ${type} found`));
            }
        }
        for (let i = 2; i < value.length; i++) {
            type = getType(value[i]);
            if (unbundle(value[1]) === '$type') {
                errors = errors.concat(validateEnum({
                    key: `${key}[${i}]`,
                    value: value[i],
                    valueSpec: styleSpec.geometry_type,
                    style: options.style,
                    styleSpec: options.styleSpec
                }));
            } else if (type !== 'string' && type !== 'number' && type !== 'boolean') {
                errors.push(new ValidationError(`${key}[${i}]`, value[i], `string, number, or boolean expected, ${type} found`));
            }
        }
        break;

    case 'any':
    case 'all':
    case 'none':
        for (let i = 1; i < value.length; i++) {
            errors = errors.concat(validateNonExpressionFilter(({
                key: `${key}[${i}]`,
                value: value[i],
                style: options.style,
                styleSpec: options.styleSpec
            }: any)));
        }
        break;

    case 'has':
    case '!has':
        type = getType(value[1]);
        if (value.length !== 2) {
            errors.push(new ValidationError(key, value, `filter array for "${value[0]}" operator must have 2 elements`));
        } else if (type !== 'string') {
            errors.push(new ValidationError(`${key}[1]`, value[1], `string expected, ${type} found`));
        }
        break;
    case 'within':
        type = getType(value[1]);
        if (value.length !== 2) {
            errors.push(new ValidationError(key, value, `filter array for "${value[0]}" operator must have 2 elements`));
        } else if (type !== 'object') {
            errors.push(new ValidationError(`${key}[1]`, value[1], `object expected, ${type} found`));
        }
        break;
    }
    return errors;
}
