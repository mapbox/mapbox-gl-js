import {default as ValidationError, ValidationWarning} from '../error/validation_error';
import getType from '../util/get_type';
import validate from './validate';
import {unbundle} from '../util/unbundle_jsonlint';

import type {ValidationOptions} from './validate';
import type {LightsSpecification} from '../types';

type Options = ValidationOptions & {
    arrayIndex: number;
};

export default function validateLights(options: Options): Array<ValidationError> {
    const light = options.value;
    let errors = [];

    if (!light) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return errors;
    }

    const type = getType(light);
    if (type !== 'object') {
        errors = errors.concat([new ValidationError('light-3d', light, `object expected, ${type} found`)]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
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
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return errors;
        }
    }

    if (light.type && lights) {
        for (let i = 0; i < options.arrayIndex; i++) {
            const lightType = unbundle(light.type);
            // const otherLight = lights[i];
            const otherLight = lights[i] as LightsSpecification & { id: { __line__: number } };
            if (unbundle(otherLight.type) === lightType) {
                errors.push(new ValidationError(key, light.id, `duplicate light type "${light.type}", previously defined at line ${otherLight.id.__line__}`));
            }
        }
    }

    const lightType = `properties_light_${light['type']}`;
    if (!(lightType in styleSpec)) {
        errors = errors.concat([new ValidationError('light-3d', light, `Invalid light type ${light['type']}`)]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return errors;
    }

    const lightPropertySpec = styleSpec[lightType];

    for (const key in light) {
        if (key === 'properties') {
            const properties = light[key];
            const propertiesType = getType(properties);
            if (propertiesType !== 'object') {
                errors = errors.concat([new ValidationError('properties', properties, `object expected, ${propertiesType} found`)]);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return
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

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return errors;
}
