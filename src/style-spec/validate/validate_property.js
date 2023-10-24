// @flow

import validate from './validate.js';
import {default as ValidationError, ValidationWarning} from '../error/validation_error.js';
import getType from '../util/get_type.js';
import {isFunction} from '../function/index.js';
import {unbundle, deepUnbundle} from '../util/unbundle_jsonlint.js';
import {supportsLightExpression, supportsPropertyExpression, supportsZoomExpression} from '../util/properties.js';
import {isGlobalPropertyConstant} from '../expression/is_constant.js';

import type {ValidationOptions} from './validate.js';
import {createPropertyExpression} from '../expression/index.js';

export type PropertyValidationOptions = ValidationOptions & {
    objectKey: string;
    layerType: string;
    layer: Object;
}

export default function validateProperty(options: PropertyValidationOptions, propertyType: string): Array<ValidationError> {
    const key = options.key;
    const style = options.style;
    const layer = options.layer;
    const styleSpec = options.styleSpec;
    const value = options.value;
    const propertyKey = options.objectKey;
    const layerSpec = styleSpec[`${propertyType}_${options.layerType}`];

    if (!layerSpec) return [];

    const transitionMatch = propertyKey.match(/^(.*)-transition$/);
    if (propertyType === 'paint' && transitionMatch && layerSpec[transitionMatch[1]] && layerSpec[transitionMatch[1]].transition) {
        return validate({
            key,
            value,
            valueSpec: styleSpec.transition,
            style,
            styleSpec
        });
    }

    const valueSpec = options.valueSpec || layerSpec[propertyKey];
    if (!valueSpec) {
        return [new ValidationWarning(key, value, `unknown property "${propertyKey}"`)];
    }

    let tokenMatch: ?RegExp$matchResult;
    if (getType(value) === 'string' && supportsPropertyExpression(valueSpec) && !valueSpec.tokens && (tokenMatch = /^{([^}]+)}$/.exec(value))) {
        const example = `\`{ "type": "identity", "property": ${tokenMatch ? JSON.stringify(tokenMatch[1]) : '"_"'} }\``;
        return [new ValidationError(
            key, value,
            `"${propertyKey}" does not support interpolation syntax\n` +
                `Use an identity property function instead: ${example}.`)];
    }

    const errors = [];

    if (options.layerType === 'symbol') {
        if (propertyKey === 'text-field' && style && !style.glyphs && !style.imports) {
            errors.push(new ValidationError(key, value, 'use of "text-field" requires a style "glyphs" property'));
        }
        if (propertyKey === 'text-font' && isFunction(deepUnbundle(value)) && unbundle(value.type) === 'identity') {
            errors.push(new ValidationError(key, value, '"text-font" does not support identity functions'));
        }
    } else if (options.layerType === 'model' && propertyType === 'paint' && layer && layer.layout && layer.layout.hasOwnProperty('model-id')) {
        if (supportsPropertyExpression(valueSpec) && (supportsLightExpression(valueSpec) || supportsZoomExpression(valueSpec))) {
            // Performance related style spec limitation: zoom and light expressions are not allowed for e.g. trees.
            const expression = createPropertyExpression(deepUnbundle(value), valueSpec);
            const expressionObj = (expression.value: any).expression || (expression.value: any)._styleExpression.expression;
            if (expressionObj && !isGlobalPropertyConstant(expressionObj, ['measure-light'])) {
                errors.push(new ValidationError(key, value, `${propertyKey} does not support measure-light expressions when the model layer source is vector tile or GeoJSON.`));
            }
        }
    }

    return errors.concat(validate({
        key: options.key,
        value,
        valueSpec,
        style,
        styleSpec,
        expressionContext: 'property',
        propertyType,
        propertyKey
    }));
}
