import validateObject from './validate_object';
import {default as ValidationError} from '../error/validation_error';
import {unbundle} from '../util/unbundle_jsonlint';
import {isObject} from '../util/get_type';

import type {StyleReference} from '../reference/latest';
import type {StyleSpecification, IconsetSpecification} from '../types';

type IconsetValidatorOptions = {
    key: string;
    value: unknown;
    style: Partial<StyleSpecification>;
    styleSpec: StyleReference;
};

function isSourceIconset(type: IconsetSpecification['type'], iconset: Record<PropertyKey, unknown>): iconset is Extract<IconsetSpecification, {type: 'source'}> {
    return !!(type === 'source' && iconset.source);
}

export default function validateIconset(options: IconsetValidatorOptions): ValidationError[] {
    const iconset = options.value;
    const key = options.key;
    const styleSpec = options.styleSpec;
    const style = options.style;

    if (!isObject(iconset)) {
        return [new ValidationError(key, iconset, 'object expected')];
    }

    if (!iconset.type) {
        return [new ValidationError(key, iconset, '"type" is required')];
    }

    const type = unbundle(iconset.type) as IconsetSpecification['type'];

    let errors: ValidationError[] = [];

    errors = errors.concat(validateObject({
        key,
        value: iconset,
        valueSpec: styleSpec[`iconset_${type}`],
        style,
        styleSpec
    }));

    if (isSourceIconset(type, iconset)) {
        const source = style.sources && style.sources[iconset.source];
        const sourceType = source && unbundle(source.type) as string;
        if (!source) {
            errors.push(new ValidationError(key, iconset.source, `source "${iconset.source}" not found`));
        } else if (sourceType !== 'raster-array') {
            errors.push(new ValidationError(key, iconset.source, `iconset cannot be used with a source of type ${String(sourceType)}, it only be used with a "raster-array" source type`));
        }
    }

    return errors;
}
