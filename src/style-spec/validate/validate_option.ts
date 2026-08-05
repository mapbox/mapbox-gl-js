import validateSpec from './validate';
import validateObject from './validate_object';
import {unbundle} from '../util/unbundle_jsonlint';
import {isObject} from '../util/get_type';

import type ValidationError from '../error/validation_error';
import type {ValidatorOptions} from './validate';
import type {ObjectElementValidator} from './validate_object';

// Validator for a single config option (one entry in `schema`). Wraps the
// generic object validator to inherit the option's declared `type` when
// validating its `default`, so expressions in the default are checked against
// the option's expected type instead of `*` (any).
export default function validateOption(options: ValidatorOptions): ValidationError[] {
    const styleSpec = options.styleSpec;
    const optionValue = options.value as {type?: unknown; array?: unknown} | null | undefined;
    // Don't propagate the declared type for array options: `getExpectedType`
    // doesn't model the schema's `array: true` flag, so forcing a scalar type
    // here would reject an array-of-T default that previously validated fine.
    const isArrayOption = isObject(optionValue) && unbundle(optionValue.array) === true;
    const declaredType = !isArrayOption && isObject(optionValue) ? unbundle(optionValue.type) : undefined;

    const validateDefault = (elementOptions: ValidatorOptions): ValidationError[] => {
        const defaultValue = elementOptions.value;
        if (isObject(defaultValue)) {
            // A plain object default (e.g. a GeoJSON geometry for an
            // `object`-typed option) isn't an expression or a legacy
            // function spec -- validate it as a bare value like a runtime
            // `config` value, instead of running it through
            // validateFunction()/validateExpression() (see `validate()`).
            return validateSpec({...elementOptions, valueSpec: {...elementOptions.valueSpec, type: '*', expression: undefined} as unknown as typeof elementOptions.valueSpec});
        }
        // Only propagate the declared type when the default is an
        // expression (array-form). Primitive defaults keep the previous
        // permissive validation, mirroring the runtime parser's narrowing
        // in style.ts/parser.cpp.
        if (declaredType && Array.isArray(defaultValue)) {
            return validateSpec({...elementOptions, valueSpec: {...elementOptions.valueSpec, type: declaredType} as typeof elementOptions.valueSpec});
        }
        return validateSpec(elementOptions);
    };

    return validateObject({
        ...options,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        valueSpec: styleSpec.option,
        objectElementValidators: {
            default: validateDefault,
        } as Record<string, ObjectElementValidator>,
    });
}
