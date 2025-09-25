import ValidationError from '../error/validation_error';
import {createExpression, createPropertyExpression} from '../expression/index';
import {deepUnbundle} from '../util/unbundle_jsonlint';
import {isStateConstant, isGlobalPropertyConstant, isFeatureConstant} from '../expression/is_constant';
import CompoundExpression from '../expression/compound_expression';

import type {StylePropertySpecification} from '../style-spec';
import type {Expression} from '../expression/expression';
import type {StyleReference} from '../reference/latest';
import type {StyleSpecification} from '../types';

export type ExpressionValidatorOptions = {
    key: string;
    value: unknown;
    valueSpec?: Partial<StylePropertySpecification>;
    propertyKey?: 'text-font';
    propertyType?: 'layout' | 'paint' | 'filter';
    style?: Partial<StyleSpecification>;
    styleSpec?: StyleReference;
    expressionContext?: 'property' | 'filter' | 'cluster-initial' | 'cluster-reduce' | 'cluster-map' | 'appearance';
};

export default function validateExpression(options: ExpressionValidatorOptions): ValidationError[] {
    const expression = (options.expressionContext === 'property' ? createPropertyExpression : createExpression)(deepUnbundle(options.value), options.valueSpec as StylePropertySpecification);
    if (expression.result === 'error') {
        return expression.value.map((error) => {
            return new ValidationError(`${options.key}${error.key}`, options.value, error.message);
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const expressionObj = (expression.value as any).expression || (expression.value as any)._styleExpression.expression;

    if (options.expressionContext === 'property' && (options.propertyKey === 'text-font') &&
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        !expressionObj.outputDefined()) {
        return [new ValidationError(options.key, options.value, `Invalid data expression for "${options.propertyKey}". Output values must be contained as literals within the expression.`)];
    }

    if (options.expressionContext === 'property' && options.propertyType === 'layout' &&
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        (!isStateConstant(expressionObj))) {
        return [new ValidationError(options.key, options.value, '"feature-state" data expressions are not supported with layout properties.')];
    }

    if (options.expressionContext === 'filter') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        return disallowedFilterParameters(expressionObj, options);
    }

    if (options.expressionContext === 'appearance') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        return checkDisallowedParameters(expressionObj, options);
    }

    if (options.expressionContext && options.expressionContext.indexOf('cluster') === 0) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        if (!isGlobalPropertyConstant(expressionObj, ['zoom', 'feature-state'])) {
            return [new ValidationError(options.key, options.value, '"zoom" and "feature-state" expressions are not supported with cluster properties.')];
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        if (options.expressionContext === 'cluster-initial' && !isFeatureConstant(expressionObj)) {
            return [new ValidationError(options.key, options.value, 'Feature data expressions are not supported with initial expression part of cluster properties.')];
        }
    }

    return [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function disallowedFilterParameters(e: Expression, options: any): ValidationError[] {
    const disallowedParameters = new Set([
        'zoom',
        'feature-state',
        'pitch',
        'distance-from-center'
    ]);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (options.valueSpec && options.valueSpec.expression) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        for (const param of options.valueSpec.expression.parameters) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            disallowedParameters.delete(param);
        }
    }

    if (disallowedParameters.size === 0) {
        return [];
    }
    const errors: ValidationError[] = [];

    if (e instanceof CompoundExpression) {
        if (disallowedParameters.has(e.name)) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
            return [new ValidationError(options.key, options.value, `["${e.name}"] expression is not supported in a filter for a ${options.object.type} layer with id: ${options.object.id}`)];
        }
    }
    e.eachChild((arg) => {
        errors.push(...disallowedFilterParameters(arg, options));
    });

    return errors;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function checkDisallowedParameters(e: Expression, options: any): ValidationError[] {
    const allowedParameters = new Set<string>();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (options.valueSpec && options.valueSpec.expression) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        for (const param of options.valueSpec.expression.parameters) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            allowedParameters.add(param);
        }
    }

    if (allowedParameters.size === 0) {
        return [];
    }
    const errors: ValidationError[] = [];

    if (e instanceof CompoundExpression) {
        if (!allowedParameters.has(e.name)) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
            return [new ValidationError(options.key, options.value, `["${e.name}"] is not an allowed parameter`)];
        }
    }
    e.eachChild((arg) => {
        errors.push(...checkDisallowedParameters(arg, options));
    });

    return errors;
}
