import {typeEquals, ValueType} from '../types';
import {Color, typeOf, toString as valueToString} from '../values';
import Formatted from '../types/formatted';
import ResolvedImage from '../types/resolved_image';
import * as isConstant from '../is_constant';
import Literal from './literal';

import type {Type} from '../types';
import type {Expression, SerializedExpression} from '../expression';
import type ParsingContext from '../parsing_context';
import type EvaluationContext from '../evaluation_context';

const FQIDSeparator = '\u001F';

function makeConfigFQID(id: string, ownScope?: string | null, contextScope?: string | null): string {
    return [id, ownScope, contextScope].filter(Boolean).join(FQIDSeparator);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function coerceValue(type: string, value: any): any {
    switch (type) {
    case 'string': return valueToString(value);
    case 'number': return +value;
    case 'boolean': return !!value;
    case 'color': return Color.parse(value);
    case 'formatted': {
        return Formatted.fromString(valueToString(value));
    }
    case 'resolvedImage': {
        return ResolvedImage.build(valueToString(value));
    }
    }
    return value;
}

function clampToAllowedNumber(value: number, min?: number, max?: number, step?: number): number {
    if (step !== undefined) {
        value = step * Math.round(value / step);
    }
    if (min !== undefined && value < min) {
        value = min;
    }
    if (max !== undefined && value > max) {
        value = max;
    }
    return value;
}

class Config implements Expression {
    type: Type;
    key: string;
    scope: string | null | undefined;
    featureConstant: boolean;

    constructor(type: Type, key: string, scope?: string, featureConstant: boolean = false) {
        this.type = type;
        this.key = key;
        this.scope = scope;
        this.featureConstant = featureConstant;
    }

    static parse(args: ReadonlyArray<unknown>, context: ParsingContext): Config | null | void {
        let type = context.expectedType;
        if (type === null || type === undefined) {
            type = ValueType;
        }
        if (args.length < 2 || args.length > 3) {
            return context.error(`Invalid number of arguments for 'config' expression.`);
        }

        const configKey = context.parse(args[1], 1);
        if (!(configKey instanceof Literal)) {
            return context.error(`Key name of 'config' expression must be a string literal.`);
        }

        let featureConstant = true;
        let configScopeValue: string | undefined;
        const configKeyValue = valueToString(configKey.value);

        if (args.length >= 3) {
            const configScope = context.parse(args[2], 2);
            if (!(configScope instanceof Literal)) {
                return context.error(`Scope of 'config' expression must be a string literal.`);
            }

            configScopeValue = valueToString(configScope.value);
        }

        if (context.options) {
            const fqid = makeConfigFQID(configKeyValue, configScopeValue, context._scope);
            const config = context.options.get(fqid);
            if (config) {
                featureConstant = isConstant.isFeatureConstant(config.value || config.default);
            }
        }

        return new Config(type, configKeyValue, configScopeValue, featureConstant);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    evaluate(ctx: EvaluationContext): any {
        const fqid = makeConfigFQID(this.key, this.scope, ctx.scope);
        const config = ctx.getConfig(fqid);
        if (!config) return null;

        const {type, value, values, minValue, maxValue, stepValue} = config;

        const defaultValue = config.default.evaluate(ctx);

        let result = defaultValue;
        if (value) {
            // temporarily override scope to parent to evaluate config expressions passed from the parent
            const originalScope = ctx.scope;
            ctx.scope = (originalScope || '').split(FQIDSeparator).slice(1).join(FQIDSeparator);
            result = value.evaluate(ctx);
            ctx.scope = originalScope;
        }
        if (type) {
            result = coerceValue(type, result);
        }

        if (result !== undefined && (minValue !== undefined || maxValue !== undefined || stepValue !== undefined)) {
            if (typeof result === 'number') {
                result = clampToAllowedNumber(result, minValue, maxValue, stepValue);
            } else if (Array.isArray(result)) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                result = result.map((item) => (typeof item === 'number' ? clampToAllowedNumber(item, minValue, maxValue, stepValue) : item));
            }
        }

        if (value !== undefined && result !== undefined && values && !values.includes(result)) {
            // The result is not among the allowed values. Instead, use the default value from the option.
            result = defaultValue;
            if (type) {
                result = coerceValue(type, result);
            }
        }

        // @ts-expect-error - TS2367 - This comparison appears to be unintentional because the types 'string' and 'Type' have no overlap.
        if ((type && type !== this.type) || (result !== undefined && !typeEquals(typeOf(result), this.type))) {
            result = coerceValue(this.type.kind, result);
        }

        return result;
    }

    eachChild() { }

    outputDefined(): boolean {
        return false;
    }

    serialize(): SerializedExpression {
        const res = ["config", this.key];
        if (this.scope) {
            res.concat(this.scope);
        }
        return res;
    }
}

export default Config;
