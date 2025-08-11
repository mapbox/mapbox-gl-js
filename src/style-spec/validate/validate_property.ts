import validate from './validate';
import {default as ValidationError, ValidationWarning} from '../error/validation_error';
import {isString} from '../util/get_type';
import {isFunction} from '../function/index';
import {unbundle, deepUnbundle} from '../util/unbundle_jsonlint';
import {supportsLightExpression, supportsPropertyExpression, supportsZoomExpression} from '../util/properties';
import {isGlobalPropertyConstant, isFeatureConstant, isStateConstant} from '../expression/is_constant';
import {createPropertyExpression, isExpression} from '../expression/index';

import type {StyleReference} from '../reference/latest';
import type {StyleSpecification, LayerSpecification} from '../types';

export type PropertyValidatorOptions = {
    key: string;
    value: unknown;
    valueSpec: unknown;
    style: Partial<StyleSpecification>;
    styleSpec: StyleReference;
    objectKey: string;
    layerType: string;
    layer: LayerSpecification;
};

export default function validateProperty(options: PropertyValidatorOptions, propertyType: string): ValidationError[] {
    const key = options.key;
    const style = options.style;
    const layer = options.layer;
    const styleSpec = options.styleSpec;
    const value = options.value;
    const propertyKey = options.objectKey;
    const layerSpec = styleSpec[`${propertyType}_${options.layerType}`];

    if (!layerSpec) return [];

    const useThemeMatch = propertyKey.match(/^(.*)-use-theme$/);
    if (useThemeMatch && layerSpec[useThemeMatch[1]]) {
        if (isExpression(value)) {
            const errors: ValidationError[] = [];
            return errors.concat(validate({
                key: options.key,
                value,
                valueSpec: {
                    "type": "string",
                    "expression": {
                        "interpolated": false,
                        "parameters": [
                            "zoom",
                            "feature"
                        ]
                    },
                    "property-type": "data-driven"
                },
                style,
                styleSpec,
                expressionContext: 'property',
                propertyType,
                propertyKey
            }));
        }
        return validate({
            key,
            value,
            valueSpec: {type: 'string'},
            style,
            styleSpec
        });
    }

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

    let tokenMatch: RegExpExecArray | undefined;
    if (isString(value) && supportsPropertyExpression(valueSpec) && !valueSpec.tokens && (tokenMatch = /^{([^}]+)}$/.exec(value))) {
        const example = `\`{ "type": "identity", "property": ${tokenMatch ? JSON.stringify(tokenMatch[1]) : '"_"'} }\``;
        return [new ValidationError(
            key, value,
            `"${propertyKey}" does not support interpolation syntax\n` +
                `Use an identity property function instead: ${example}.`)];
    }

    const errors: ValidationError[] = [];

    if (options.layerType === 'symbol') {
        if (propertyKey === 'text-field' && style && !style.glyphs && !style.imports) {
            errors.push(new ValidationError(key, value, 'use of "text-field" requires a style "glyphs" property'));
        }
        if (propertyKey === 'text-font' && isFunction(deepUnbundle(value)) && unbundle((value as {type: unknown}).type) === 'identity') {
            errors.push(new ValidationError(key, value, '"text-font" does not support identity functions'));
        }
    } else if (options.layerType === 'model' && propertyType === 'paint' && layer && layer.layout && layer.layout.hasOwnProperty('model-id')) {
        if (supportsPropertyExpression(valueSpec) && (supportsLightExpression(valueSpec) || supportsZoomExpression(valueSpec))) {
            // Performance related style spec limitation: zoom and light expressions are not allowed for e.g. trees.
            const expression = createPropertyExpression(deepUnbundle(value), valueSpec);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const expressionObj = (expression.value as any).expression || (expression.value as any)._styleExpression.expression;

            if (expressionObj && !isGlobalPropertyConstant(expressionObj, ['measure-light'])) {
                if (propertyKey !== 'model-emissive-strength' || (!isFeatureConstant(expressionObj) || !isStateConstant(expressionObj))) {
                    errors.push(new ValidationError(key, value, `${propertyKey} does not support measure-light expressions when the model layer source is vector tile or GeoJSON.`));
                }
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
