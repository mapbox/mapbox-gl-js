import {default as ValidationError, ValidationWarning} from '../error/validation_error';
import validate from './validate';
import {getType, isObject, isString} from '../util/get_type';
import {unbundle} from '../util/unbundle_jsonlint';

import type {StyleReference} from '../reference/latest';
import type {StyleSpecification} from '../types';

type TerrainValidatorOptions = {
    key: string;
    value: unknown;
    styleSpec: StyleReference;
    style: Partial<StyleSpecification>;
};

export default function validateTerrain(options: TerrainValidatorOptions): ValidationError[] {
    const terrain = options.value;
    const key = options.key;
    const style = options.style;
    const styleSpec = options.styleSpec;
    const terrainSpec = styleSpec.terrain;

    if (terrain == null) {
        return [];
    }

    if (!isObject(terrain)) {
        return [new ValidationError('terrain', terrain, `object expected, ${getType(terrain)} found`)];
    }

    let errors: ValidationError[] = [];
    for (const key in terrain) {
        const transitionMatch = key.match(/^(.*)-transition$/);
        const useThemeMatch = key.match(/^(.*)-use-theme$/);

        if (useThemeMatch && terrainSpec[useThemeMatch[1]]) {
            errors = errors.concat(validate({
                key,
                value: terrain[key],
                valueSpec: {type: 'string'},
                style,
                styleSpec
            }));
        } else if (transitionMatch && terrainSpec[transitionMatch[1]] && terrainSpec[transitionMatch[1]].transition) {
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
            errors = errors.concat([new ValidationWarning(key, terrain[key], `unknown property "${key}"`)]);
        }
    }

    if (!terrain.source) {
        errors.push(new ValidationError(key, terrain, `terrain is missing required property "source"`));
    } else if (!isString(terrain.source)) {
        errors.push(new ValidationError(`${key}.source`, terrain.source, `source must be a string`));
    } else {
        const source = style.sources && style.sources[terrain.source];
        const sourceType = source && unbundle(source.type) as string;
        if (!source) {
            errors.push(new ValidationError(`${key}.source`, terrain.source, `source "${terrain.source}" not found`));
        } else if (sourceType !== 'raster-dem') {
            errors.push(new ValidationError(`${key}.source`, terrain.source, `terrain cannot be used with a source of type ${sourceType}, it only be used with a "raster-dem" source type`));
        }
    }

    return errors;
}
