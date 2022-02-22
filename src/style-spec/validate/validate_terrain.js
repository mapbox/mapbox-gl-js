// @flow

import ValidationError from '../error/validation_error.js';
import validate from './validate.js';
import getType from '../util/get_type.js';
import {unbundle} from '../util/unbundle_jsonlint.js';

import type {ValidationOptions} from './validate.js';

export default function validateTerrain(options: ValidationOptions): Array<ValidationError> {
    const terrain = options.value;
    const key = options.key;
    const style = options.style;
    const styleSpec = options.styleSpec;
    const terrainSpec = styleSpec.terrain;
    let errors = [];

    const rootType = getType(terrain);
    if (terrain === undefined) {
        return errors;
    } else if (rootType !== 'object') {
        errors = errors.concat([new ValidationError('terrain', terrain, `object expected, ${rootType} found`)]);
        return errors;
    }

    for (const key in terrain) {
        const transitionMatch = key.match(/^(.*)-transition$/);

        if (transitionMatch && terrainSpec[transitionMatch[1]] && terrainSpec[transitionMatch[1]].transition) {
            errors = errors.concat(validate({
                key,
                value: terrain[key],
                valueSpec: styleSpec.transition,
                style,
                styleSpec
            }));
        } else if (terrainSpec[key]) {
            errors = errors.concat(validate({
                key,
                value: terrain[key],
                valueSpec: terrainSpec[key],
                style,
                styleSpec
            }));
        } else {
            errors = errors.concat([new ValidationError(key, terrain[key], `unknown property "${key}"`)]);
        }
    }

    if (!terrain.source) {
        errors.push(new ValidationError(key, terrain, `terrain is missing required property "source"`));
    } else {
        const source = style.sources && style.sources[terrain.source];
        const sourceType = source && unbundle(source.type);
        if (!source) {
            errors.push(new ValidationError(key, terrain.source, `source "${terrain.source}" not found`));
        } else if (sourceType !== 'raster-dem') {
            errors.push(new ValidationError(key, terrain.source, `terrain cannot be used with a source of type ${String(sourceType)}, it only be used with a "raster-dem" source type`));
        }
    }

    return errors;
}
