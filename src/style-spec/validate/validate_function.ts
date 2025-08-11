import ValidationError from '../error/validation_error';
import {getType, isObject} from '../util/get_type';
import validate from './validate';
import validateObject from './validate_object';
import validateArray from './validate_array';
import validateNumber from './validate_number';
import {isExpression} from '../expression/index';
import {unbundle, deepUnbundle} from '../util/unbundle_jsonlint';
import {
    supportsPropertyExpression,
    supportsZoomExpression,
    supportsInterpolation
} from '../util/properties';

import type {StyleReference} from '../reference/latest';
import type {StyleSpecification} from '../types';
import type {StylePropertySpecification} from '../style-spec';

function hasObjectStops(value: object): value is {stops: Array<Record<PropertyKey, unknown>>} {
    const stops = value['stops'];
    return Array.isArray(stops) && Array.isArray(stops[0]) && isObject(stops[0][0]);
}

export type FunctionValidatorOptions = {
    key: string;
    value: unknown;
    valueSpec: unknown;
    style: Partial<StyleSpecification>;
    styleSpec: StyleReference;
};

export default function validateFunction(options: FunctionValidatorOptions): ValidationError[] {
    const key = options.key;
    const value = options.value;

    if (!isObject(value)) {
        return [new ValidationError(key, value, `object expected, ${getType(value)} found`)];
    }

    const functionValueSpec = options.valueSpec;
    const functionType = unbundle(value.type);
    let stopKeyType;
    let stopDomainValues: Partial<Record<string | number, boolean>> = {};
    let previousStopDomainValue: unknown;
    let previousStopDomainZoom;

    const isZoomFunction = functionType !== 'categorical' && value.property === undefined;
    const isPropertyFunction = !isZoomFunction;
    const isZoomAndPropertyFunction = hasObjectStops(value);

    const errors = validateObject({
        key: options.key,
        value: options.value,
        valueSpec: options.styleSpec.function,
        style: options.style,
        styleSpec: options.styleSpec,
        objectElementValidators: {
            stops: validateFunctionStops,
            default: validateFunctionDefault
        }
    });

    if (functionType === 'identity' && isZoomFunction) {
        errors.push(new ValidationError(options.key, options.value, 'missing required property "property"'));
    }

    if (functionType !== 'identity' && !value.stops) {
        errors.push(new ValidationError(options.key, options.value, 'missing required property "stops"'));
    }

    if (functionType === 'exponential' && (functionValueSpec as {expression?: unknown}).expression && !supportsInterpolation(functionValueSpec as StylePropertySpecification)) {
        errors.push(new ValidationError(options.key, options.value, 'exponential functions not supported'));
    }

    if (options.styleSpec.$version >= 8) {
        if (isPropertyFunction && !supportsPropertyExpression(functionValueSpec as StylePropertySpecification)) {
            errors.push(new ValidationError(options.key, options.value, 'property functions not supported'));
        } else if (isZoomFunction && !supportsZoomExpression(functionValueSpec as StylePropertySpecification)) {
            errors.push(new ValidationError(options.key, options.value, 'zoom functions not supported'));
        }
    }

    if ((functionType === 'categorical' || isZoomAndPropertyFunction) && (value as {property?: string}).property === undefined) {
        errors.push(new ValidationError(options.key, options.value, '"property" property is required'));
    }

    return errors;

    function validateFunctionStops(options: FunctionValidatorOptions): ValidationError[] {
        if (functionType === 'identity') {
            return [new ValidationError(options.key, options.value, 'identity function may not have a "stops" property')];
        }

        let errors: ValidationError[] = [];
        const value = options.value;

        errors = errors.concat(validateArray({
            key: options.key,
            value,
            valueSpec: options.valueSpec as Extract<StylePropertySpecification, {type: 'array'}>,
            style: options.style,
            styleSpec: options.styleSpec,
            arrayElementValidator: validateFunctionStop
        }));

        if (Array.isArray(value) && value.length === 0) {
            errors.push(new ValidationError(options.key, value, 'array must have at least one stop'));
        }

        return errors;
    }

    function validateFunctionStop(options: FunctionValidatorOptions): ValidationError[] {
        let errors: ValidationError[] = [];
        const value = options.value;
        const key = options.key;

        if (!Array.isArray(value)) {
            return [new ValidationError(key, value, `array expected, ${getType(value)} found`)];
        }

        if (value.length !== 2) {
            return [new ValidationError(key, value, `array length 2 expected, length ${value.length} found`)];
        }

        if (isZoomAndPropertyFunction) {
            if (!isObject(value[0])) {
                return [new ValidationError(key, value, `object expected, ${getType(value[0])} found`)];
            }

            const stopKey = value[0];
            if (stopKey.zoom === undefined) {
                return [new ValidationError(key, value, 'object stop key must have zoom')];
            }
            if (stopKey.value === undefined) {
                return [new ValidationError(key, value, 'object stop key must have value')];
            }

            const nextStopDomainZoom = unbundle(stopKey.zoom);
            if (typeof nextStopDomainZoom !== 'number') {
                return [new ValidationError(key, stopKey.zoom, 'stop zoom values must be numbers')];
            }

            if (previousStopDomainZoom && previousStopDomainZoom > nextStopDomainZoom) {
                return [new ValidationError(key, stopKey.zoom, 'stop zoom values must appear in ascending order')];
            }
            if (nextStopDomainZoom !== previousStopDomainZoom) {
                previousStopDomainZoom = nextStopDomainZoom;
                previousStopDomainValue = undefined;
                stopDomainValues = {};
            }
            errors = errors.concat(validateObject({
                key: `${key}[0]`,
                value: value[0],
                valueSpec: {zoom: {}},
                style: options.style,
                styleSpec: options.styleSpec,
                objectElementValidators: {zoom: validateNumber, value: validateStopDomainValue}
            }));
        } else {
            errors = errors.concat(validateStopDomainValue({
                key: `${key}[0]`,
                value: value[0],
                valueSpec: {},
                style: options.style,
                styleSpec: options.styleSpec
            }, value));
        }

        if (isExpression(deepUnbundle(value[1]))) {
            return errors.concat([new ValidationError(`${key}[1]`, value[1], 'expressions are not allowed in function stops.')]);
        }

        return errors.concat(validate({
            key: `${key}[1]`,
            value: value[1],
            valueSpec: functionValueSpec,
            style: options.style,
            styleSpec: options.styleSpec
        }));
    }

    function validateStopDomainValue(options: FunctionValidatorOptions, stop?: unknown[]): ValidationError[] {
        const type = getType(options.value);
        const value = unbundle(options.value);

        const reportValue = options.value !== null ? options.value : stop;

        if (!stopKeyType) {
            stopKeyType = type;
        } else if (type !== stopKeyType) {
            return [new ValidationError(options.key, reportValue, `${type} stop domain type must match previous stop domain type ${stopKeyType}`)];
        }

        if (type !== 'number' && type !== 'string' && type !== 'boolean' && typeof value !== 'number' && typeof value !== 'string' && typeof value !== 'boolean') {
            return [new ValidationError(options.key, reportValue, 'stop domain value must be a number, string, or boolean')];
        }

        if (type !== 'number' && functionType !== 'categorical') {
            let message = `number expected, ${type} found`;
            if (supportsPropertyExpression(functionValueSpec as StylePropertySpecification) && functionType === undefined) {
                message += '\nIf you intended to use a categorical function, specify `"type": "categorical"`.';
            }
            return [new ValidationError(options.key, reportValue, message)];
        }

        if (functionType === 'categorical' && type === 'number' && (typeof value !== 'number' || !isFinite(value) || Math.floor(value) !== value)) {
            return [new ValidationError(options.key, reportValue, `integer expected, found ${String(value as number)}`)];
        }

        if (functionType !== 'categorical' && type === 'number' && typeof value === 'number' && typeof previousStopDomainValue === 'number' && previousStopDomainValue !== undefined && value < previousStopDomainValue) {
            return [new ValidationError(options.key, reportValue, 'stop domain values must appear in ascending order')];
        } else {
            previousStopDomainValue = value;
        }

        if (functionType === 'categorical' && (value as string) in stopDomainValues) {
            return [new ValidationError(options.key, reportValue, 'stop domain values must be unique')];
        } else {
            stopDomainValues[(value as string)] = true;
        }

        return [];
    }

    function validateFunctionDefault(options: FunctionValidatorOptions) {
        return validate({
            key: options.key,
            value: options.value,
            valueSpec: functionValueSpec,
            style: options.style,
            styleSpec: options.styleSpec
        });
    }
}
