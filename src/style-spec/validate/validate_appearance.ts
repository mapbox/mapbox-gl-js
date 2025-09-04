import validateObject from './validate_object';
import ValidationError from '../error/validation_error';
import validateProperty from './validate_property';
import {unbundle} from '../util/unbundle_jsonlint';

import type {StyleSpecification, LayerSpecification} from '../types';
import type {StyleReference} from '../reference/latest';

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
    const value = unbundle(options.value);

    const errors = validateObject({
        key,
        value,
        valueSpec: options.styleSpec.appearance as object,
        style: options.style,
        styleSpec: options.styleSpec,
        objectElementValidators: {
            properties: (options) => validateProperties(Object.assign({layer, layerType}, options)),
        }
    });

    return errors;
}

function validateProperties(options: AppearanceValidatorOptions): Array<ValidationError> {
    const errors: Array<ValidationError> = [];

    const {styleSpec, layer, layerType} = options;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const paintProperties = styleSpec[`paint_${layerType}`];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const layoutProperties = styleSpec[`layout_${layerType}`];
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
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            valueSpec: (propertyType === 'paint' ? paintProperties[propertyKey] : layoutProperties[propertyKey]) as object,
        });

        errors.push(...validateProperty(propertyValidationOptions, propertyType));
    }

    return errors;
}
