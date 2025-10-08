import validateObject from './validate_object';
import ValidationError from '../error/validation_error';
import validateProperty from './validate_property';
import {unbundle} from '../util/unbundle_jsonlint';
import validateExpression from './validate_expression';
import latest from '../reference/latest';

import type {StyleSpecification, LayerSpecification, AppearanceSpecification} from '../types';
import type {StyleReference} from '../reference/latest';
import type {StylePropertySpecification} from '../style-spec';

export type AppearanceValidatorOptions = {
    key: string;
    value: unknown;
    style: Partial<StyleSpecification>;
    styleSpec: StyleReference;
    object?: object;
    objectKey?: string;
    layer: LayerSpecification;
    layerType: string;
};

export default function validateAppearance(options: AppearanceValidatorOptions): Array<ValidationError> {
    const {key, layer, layerType} = options;
    const value = unbundle(options.value) as AppearanceSpecification;
    const name = unbundle(value.name);
    const condition = unbundle(value.condition);

    const errors = validateObject({
        key,
        value,
        valueSpec: options.styleSpec.appearance as object,
        style: options.style,
        styleSpec: options.styleSpec,
        objectElementValidators: {
            condition: (options) => validateCondition(Object.assign({layer, layerType}, options)),
            properties: (options) => validateProperties(Object.assign({layer, layerType}, options)),
        }
    });

    if (name !== 'hidden' && condition === undefined) {
        errors.push(new ValidationError(options.key, 'name', `Appearance with name different than "hidden" must have a condition`));
    }

    return errors;
}

function validateProperties(options: AppearanceValidatorOptions): Array<ValidationError> {
    const errors: Array<ValidationError> = [];

    const {styleSpec, layer, layerType} = options;

    const paintProperties = styleSpec[`paint_${layerType}`] as Record<string, StylePropertySpecification> | undefined;
    const layoutProperties = styleSpec[`layout_${layerType}`] as Record<string, StylePropertySpecification> | undefined;
    const properties = options.object[options.objectKey] as object;

    for (const propertyKey in properties) {
        const propertyType =
            propertyKey in paintProperties ? 'paint' :
            propertyKey in layoutProperties ? 'layout' :
            undefined;

        if (!propertyType) {
            errors.push(new ValidationError(options.key, propertyKey, `unknown property "${propertyKey}" for layer type "${layerType}"`));
            continue;
        }

        const propertyValidationOptions = Object.assign({}, options, {
            key: `${options.key}.${propertyKey}`,
            object: properties,
            objectKey: propertyKey,
            layer,
            layerType,
            value: properties[propertyKey] as unknown,
            valueSpec: (propertyType === 'paint' ? paintProperties[propertyKey] : layoutProperties[propertyKey]),
        });

        errors.push(...validateProperty(propertyValidationOptions, propertyType));
    }

    return errors;
}

function validateCondition(options: AppearanceValidatorOptions): Array<ValidationError> {
    const errors: Array<ValidationError> = [];

    const appearance = options.object as AppearanceSpecification;
    const condition = appearance.condition;

    errors.push(...validateExpression({
        key: options.key,
        value: condition,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        valueSpec: latest['appearance']['condition'],
        expressionContext: 'appearance'
    }));

    return errors;
}
