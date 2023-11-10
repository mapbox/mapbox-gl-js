// @flow

import {default as ValidationError, ValidationWarning} from '../error/validation_error.js';
import getType from '../util/get_type.js';
import validate from './validate.js';
import {unbundle} from '../util/unbundle_jsonlint.js';

import type {ValidationOptions} from './validate.js';

type Options = ValidationOptions & {
    arrayIndex: number;
}

export default function validateLights(options: Options): Array<ValidationError> {
    const light = options.value;
    let errors = [];

    if (!light) {
        return errors;
    }

    const type = getType(light);
    if (type !== 'object') {
        errors = errors.concat([new ValidationError('light-3d', light, `object expected, ${type} found`)]);
        return errors;
    }

    const styleSpec = options.styleSpec;
    const lightSpec = styleSpec['light-3d'];
    const key = options.key;
    const style = options.style;
    const lights = options.style.lights;

    for (const key of ['type', 'id']) {
        if (!(key in light)) {
            errors = errors.concat([new ValidationError('light-3d', light, `missing property ${key} on light`)]);
            return errors;
        }
    }

    if (light.type && lights) {
        for (let i = 0; i < options.arrayIndex; i++) {
            const lightType = unbundle(light.type);
            const otherLight = lights[i];
            if (unbundle(otherLight.type) === lightType) {
                // $FlowFixMe[prop-missing] - id.__line__ is added dynamically during the readStyle step
                errors.push(new ValidationError(key, light.id, `duplicate light type "${light.type}", previously defined at line ${otherLight.id.__line__}`));
            }
        }
    }

    const lightType = `properties_light_${light['type']}`;
    if (!(lightType in styleSpec)) {
        errors = errors.concat([new ValidationError('light-3d', light, `Invalid light type ${light['type']}`)]);
        return errors;
    }

    const lightPropertySpec = styleSpec[lightType];

    for (const key in light) {
        if (key === 'properties') {
            const properties = light[key];
            const propertiesType = getType(properties);
            if (propertiesType !== 'object') {
                errors = errors.concat([new ValidationError('properties', properties, `object expected, ${propertiesType} found`)]);
                return errors;
            }
            for (const propertyKey in properties) {
                if (!lightPropertySpec[propertyKey]) {
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
            const transitionMatch = key.match(/^(.*)-transition$/);
            if (transitionMatch && lightSpec[transitionMatch[1]] && lightSpec[transitionMatch[1]].transition) {
                errors = errors.concat(validate({
                    key,
                    value: light[key],
                    valueSpec: styleSpec.transition,
                    style,
                    styleSpec
                }));
            } else if (lightSpec[key]) {
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
