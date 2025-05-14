import {default as ValidationError, ValidationWarning} from '../error/validation_error';
import {unbundle, deepUnbundle} from '../util/unbundle_jsonlint';
import validateObject from './validate_object';
import validateEnum from './validate_enum';
import validateExpression from './validate_expression';
import validateString from './validate_string';
import getType from '../util/get_type';
import {createExpression} from '../expression/index';
import * as isConstant from '../expression/is_constant';

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

    const type = unbundle(value.type) as string;
    let errors: ValidationError[] = [];

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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return styleSpec.source.reduce((memo: string[], source: string) => {
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
    } else if (Array.isArray(value)) {
        const errors: ValidationError[] = [];
        const unbundledValue = deepUnbundle(value);
        const expression = createExpression(unbundledValue);
        if (expression.result === 'error') {
            expression.value.forEach((err) => {
                errors.push(new ValidationError(`${key}${err.key}`, null, `${err.message}`));
            });
        }

        // @ts-expect-error - TS2339: Property 'expression' does not exist on type 'ParsingError[] | StyleExpression'.
        const parsed = expression.value.expression;
        const onlyFeatureDependent = isConstant.isGlobalPropertyConstant(parsed, ['zoom', 'heatmap-density', 'line-progress', 'raster-value', 'sky-radial-progress', 'accumulated', 'is-supported-script', 'pitch', 'distance-from-center', 'measure-light', 'raster-particle-speed']);
        if (!onlyFeatureDependent) {
            errors.push(new ValidationError(`${key}`, null, 'promoteId expression should be only feature dependent'));
        }

        return errors;
    } else {
        const errors: ValidationError[] = [];
        for (const prop in value) {
            errors.push(...validatePromoteId({key: `${key}.${prop}`, value: value[prop]}));
        }

        return errors;
    }
}
