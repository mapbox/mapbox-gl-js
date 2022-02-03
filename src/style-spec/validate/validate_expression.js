// @flow

import ValidationError from '../error/validation_error.js';

import {createExpression, createPropertyExpression} from '../expression/index.js';
import {deepUnbundle} from '../util/unbundle_jsonlint.js';
import {isStateConstant, isGlobalPropertyConstant, isFeatureConstant} from '../expression/is_constant.js';
import CompoundExpression from '../expression/compound_expression.js';

import type {Expression} from '../expression/expression.js';

export default function validateExpression(options: any): Array<ValidationError> {
    const expression = (options.expressionContext === 'property' ? createPropertyExpression : createExpression)(deepUnbundle(options.value), options.valueSpec);
    if (expression.result === 'error') {
        return expression.value.map((error) => {
            return new ValidationError(`${options.key}${error.key}`, options.value, error.message);
        });
    }

    const expressionObj = (expression.value: any).expression || (expression.value: any)._styleExpression.expression;

    if (options.expressionContext === 'property' && (options.propertyKey === 'text-font') &&
        !expressionObj.outputDefined()) {
        return [new ValidationError(options.key, options.value, `Invalid data expression for "${options.propertyKey}". Output values must be contained as literals within the expression.`)];
    }

    if (options.expressionContext === 'property' && options.propertyType === 'layout' &&
        (!isStateConstant(expressionObj))) {
        return [new ValidationError(options.key, options.value, '"feature-state" data expressions are not supported with layout properties.')];
    }

    if (options.expressionContext === 'filter') {
        return disallowedFilterParameters(expressionObj, options);
    }

    if (options.expressionContext && options.expressionContext.indexOf('cluster') === 0) {
        if (!isGlobalPropertyConstant(expressionObj, ['zoom', 'feature-state'])) {
            return [new ValidationError(options.key, options.value, '"zoom" and "feature-state" expressions are not supported with cluster properties.')];
        }
        if (options.expressionContext === 'cluster-initial' && !isFeatureConstant(expressionObj)) {
            return [new ValidationError(options.key, options.value, 'Feature data expressions are not supported with initial expression part of cluster properties.')];
        }
    }

    return [];
}

export function disallowedFilterParameters(e: Expression, options: any): Array<ValidationError> {
    const disallowedParameters = new Set([
        'zoom',
        'feature-state',
        'pitch',
        'distance-from-center'
    ]);
    for (const param of options.valueSpec.expression.parameters) {
        disallowedParameters.delete(param);
    }

    if (disallowedParameters.size === 0) {
        return [];
    }
    const errors = [];

    if (e instanceof CompoundExpression) {
        if (disallowedParameters.has(e.name)) {
            return [new ValidationError(options.key, options.value, `["${e.name}"] expression is not supported in a filter for a ${options.object.type} layer with id: ${options.object.id}`)];
        }
    }
    e.eachChild((arg) => {
        errors.push(...disallowedFilterParameters(arg, options));
    });

    return errors;
}
