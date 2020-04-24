
import ValidationError from '../error/validation_error';
import getType from '../util/get_type';
import validate from './validate';

export default function validateTerrain(options) {
    const terrain = options.value;
    const styleSpec = options.styleSpec;
    const terrainSpec = styleSpec.terrain;
    const style = options.style;

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

    return errors;
}
