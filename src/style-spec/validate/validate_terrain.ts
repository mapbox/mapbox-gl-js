import {default as ValidationError, ValidationWarning} from '../error/validation_error';
import validate from './validate';
import getType from '../util/get_type';
import {unbundle} from '../util/unbundle_jsonlint';

import type {ValidationOptions} from './validate';

export default function validateTerrain(options: ValidationOptions): Array<ValidationError> {
    const terrain = options.value;
    const key = options.key;
    const style = options.style;
    const styleSpec = options.styleSpec;
    const terrainSpec = styleSpec.terrain;
    let errors = [];

    const rootType = getType(terrain);
    if (terrain === undefined) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return errors;
    } else if (rootType === 'null') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return errors;
    } else if (rootType !== 'object') {
        errors = errors.concat([new ValidationError('terrain', terrain, `object expected, ${rootType} found`)]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return errors;
    }

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
    } else {
        const source = style.sources && style.sources[terrain.source];
        const sourceType = source && unbundle(source.type) as string;
        if (!source) {
            errors.push(new ValidationError(key, terrain.source, `source "${terrain.source}" not found`));
        } else if (sourceType !== 'raster-dem') {
            errors.push(new ValidationError(key, terrain.source, `terrain cannot be used with a source of type ${String(sourceType)}, it only be used with a "raster-dem" source type`));
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return errors;
}
