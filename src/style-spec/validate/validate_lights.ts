import {default as ValidationError, ValidationWarning} from '../error/validation_error';
import {getType, isObject, isString} from '../util/get_type';
import validate from './validate';
import {unbundle} from '../util/unbundle_jsonlint';

import type {StyleReference} from '../reference/latest';
import type {StyleSpecification} from '../types';

type LightsValidatorOptions = {
    key: string;
    value: unknown;
    style: Partial<StyleSpecification>;
    styleSpec: StyleReference;
    arrayIndex: number;
};

export default function validateLights(options: LightsValidatorOptions): ValidationError[] {
    const light = options.value;

    if (!light) {
        return [];
    }

    const key = options.key;
    if (!isObject(light)) {
        return [new ValidationError(key, light, `object expected, ${getType(light)} found`)];
    }

    let errors: ValidationError[] = [];
    const styleSpec = options.styleSpec;
    const lightSpec = styleSpec['light-3d'];
    const style = options.style;
    const lights = options.style.lights;

    for (const prop of ['type', 'id'] as const) {
        if (!(prop in light)) {
            errors = errors.concat([new ValidationError(key, light, `missing property "${prop}"`)]);
            return errors;
        }
    }

    if (!isString(light.type)) {
        errors = errors.concat([new ValidationError(`${key}.type`, light.type, `string expected`)]);
        return errors;
    }

    if (lights) {
        for (let i = 0; i < options.arrayIndex; i++) {
            const lightType = unbundle(light.type);
            const otherLight = lights[i];
            if (unbundle(otherLight.type) === lightType) {
                errors.push(new ValidationError(key, light.id, `duplicate light type "${light.type}", previously defined at line ${(otherLight.id as {__line__?: number}).__line__}`));
            }
        }
    }

    const lightType = `properties_light_${light.type}`;
    if (!(lightType in styleSpec)) {
        errors = errors.concat([new ValidationError(`${key}.type`, light, `Invalid light type ${light.type}`)]);
        return errors;
    }

    const lightPropertySpec = styleSpec[lightType];

    for (const key in light) {
        if (key === 'properties') {
            const properties = light[key];
            if (!isObject(properties)) {
                errors = errors.concat([new ValidationError('properties', properties, `object expected, ${getType(properties)} found`)]);
                return errors;
            }
            for (const propertyKey in properties) {
                const transitionMatch = propertyKey.match(/^(.*)-transition$/);
                const useThemeMatch = propertyKey.match(/^(.*)-use-theme$/);

                if (useThemeMatch && lightPropertySpec[useThemeMatch[1]]) {
                    errors = errors.concat(validate({
                        key,
                        value: properties[propertyKey],
                        valueSpec: {type: 'string'},
                        style,
                        styleSpec
                    }));
                } else if (transitionMatch && lightPropertySpec[transitionMatch[1]] && lightPropertySpec[transitionMatch[1]].transition) {
                    errors = errors.concat(validate({
                        key,
                        value: light[key],
                        valueSpec: styleSpec.transition,
                        style,
                        styleSpec
                    }));
                } else if (!lightPropertySpec[propertyKey]) {
                    errors = errors.concat([new ValidationWarning(options.key, properties[propertyKey], `unknown property "${propertyKey}"`)]);
                } else {
                    errors = errors.concat(validate({
                        key: propertyKey,
                        value: properties[propertyKey],
                        valueSpec: lightPropertySpec[propertyKey],
                        style,
                        styleSpec
                    }));
                }
            }
        } else {
            if (lightSpec[key]) {
                errors = errors.concat(validate({
                    key,
                    value: light[key],
                    valueSpec: lightSpec[key],
                    style,
                    styleSpec
                }));
            } else {
                errors = errors.concat([new ValidationWarning(key, light[key], `unknown property "${key}"`)]);
            }
        }
    }

    return errors;
}
