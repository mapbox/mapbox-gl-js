import {default as ValidationError, ValidationWarning} from '../error/validation_error';
import {unbundle} from '../util/unbundle_jsonlint';
import validateObject from './validate_object';
import validateEnum from './validate_enum';
import validateExpression from './validate_expression';
import validateString from './validate_string';
import getType from '../util/get_type';

import type {StyleReference} from '../reference/latest';
import type {ValidationOptions} from './validate';

const objectElementValidators = {
    promoteId: validatePromoteId
};

export default function validateSource(options: ValidationOptions): Array<ValidationError> {
    const value = options.value;
    const key = options.key;
    const styleSpec = options.styleSpec;
    const style = options.style;

    if (!value.type) {
        return [new ValidationError(key, value, '"type" is required')];
    }

    const type = unbundle(value.type);
    let errors = [];

    // @ts-expect-error - TS2345 - Argument of type 'unknown' is not assignable to parameter of type 'string'.
    if (['vector', 'raster', 'raster-dem', 'raster-array'].includes(type)) {
        if (!value.url && !value.tiles) {
            errors.push(new ValidationWarning(key, value, 'Either "url" or "tiles" is required.'));
        }
    }

    switch (type) {
    case 'vector':
    case 'raster':
    case 'raster-dem':
    case 'raster-array':
        errors = errors.concat(validateObject({
            key,
            value,
            valueSpec: styleSpec[`source_${type.replace('-', '_')}`],
            style: options.style,
            styleSpec,
            objectElementValidators
        }));
        return errors;

    case 'geojson':
        errors = validateObject({
            key,
            value,
            valueSpec: styleSpec.source_geojson,
            style,
            styleSpec,
            objectElementValidators
        });
        if (value.cluster) {
            for (const prop in value.clusterProperties) {
                const [operator, mapExpr] = value.clusterProperties[prop];
                const reduceExpr = typeof operator === 'string' ? [operator, ['accumulated'], ['get', prop]] : operator;

                errors.push(...validateExpression({
                    key: `${key}.${prop}.map`,
                    value: mapExpr,
                    expressionContext: 'cluster-map'
                }));
                errors.push(...validateExpression({
                    key: `${key}.${prop}.reduce`,
                    value: reduceExpr,
                    expressionContext: 'cluster-reduce'
                }));
            }
        }
        return errors;

    case 'video':
        return validateObject({
            key,
            value,
            valueSpec: styleSpec.source_video,
            style,
            styleSpec
        });

    case 'image':
        return validateObject({
            key,
            value,
            valueSpec: styleSpec.source_image,
            style,
            styleSpec
        });

    case 'canvas':
        return [new ValidationError(key, null, `Please use runtime APIs to add canvas sources, rather than including them in stylesheets.`, 'source.canvas')];

    default:
        return validateEnum({
            key: `${key}.type`,
            value: value.type,
            valueSpec: {values: getSourceTypeValues(styleSpec)},
            style,
            styleSpec
        });
    }
}

function getSourceTypeValues(styleSpec: StyleReference) {
// @ts-expect-error - TS2347 - Untyped function calls may not accept type arguments.
    return styleSpec.source.reduce<Array<any>>((memo, source) => {
        const sourceType = styleSpec[source];
        if (sourceType.type.type === 'enum') {
            memo = memo.concat(Object.keys(sourceType.type.values));
        }
        return memo;
    }, []);
}

function validatePromoteId({
    key,
    value,
}: Partial<ValidationOptions>) {
    if (getType(value) === 'string') {
        return validateString({key, value});
    } else {
        const errors = [];
        for (const prop in value) {
            errors.push(...validateString({key: `${key}.${prop}`, value: value[prop]}));
        }
        return errors;
    }
}
