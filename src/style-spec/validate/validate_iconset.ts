import {default as ValidationError} from '../error/validation_error';
import {unbundle} from '../util/unbundle_jsonlint';
import validateObject from './validate_object';

import type {ValidationOptions} from './validate';

export default function validateIconset(options: ValidationOptions): Array<ValidationError> {
    const iconset = options.value;
    const key = options.key;
    const styleSpec = options.styleSpec;
    const style = options.style;

    if (!iconset.type) {
        return [new ValidationError(key, iconset, '"type" is required')];
    }

    const type = unbundle(iconset.type) as string;

    let errors = [];

    errors = errors.concat(validateObject({
        key,
        value: iconset,
        valueSpec: styleSpec[`iconset_${type}`],
        style,
        styleSpec
    }));

    if (type === 'source' && iconset.source) {
        const source = style.sources && style.sources[iconset.source];
        const sourceType = source && unbundle(source.type) as string;
        if (!source) {
            errors.push(new ValidationError(key, iconset.source, `source "${iconset.source}" not found`));
        } else if (sourceType !== 'raster-array') {
            errors.push(new ValidationError(key, iconset.source, `iconset cannot be used with a source of type ${String(sourceType)}, it only be used with a "raster-array" source type`));
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return errors;
}
