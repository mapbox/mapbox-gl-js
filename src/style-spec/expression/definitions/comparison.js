// @flow

import {toString, ValueType, BooleanType, CollatorType} from '../types.js';
import Assertion from './assertion.js';
import {typeOf} from '../values.js';
import RuntimeError from '../runtime_error.js';

import type {Expression, SerializedExpression, ExpressionRegistration} from '../expression.js';
import type EvaluationContext from '../evaluation_context.js';
import type ParsingContext from '../parsing_context.js';
import type {Type} from '../types.js';

type ComparisonOperator = '==' | '!=' | '<' | '>' | '<=' | '>=' ;

function isComparableType(op: ComparisonOperator, type: Type) {
    if (op === '==' || op === '!=') {
        // equality operator
        return type.kind === 'boolean' ||
            type.kind === 'string' ||
            type.kind === 'number' ||
            type.kind === 'null' ||
            type.kind === 'value';
    } else {
        // ordering operator
        return type.kind === 'string' ||
            type.kind === 'number' ||
            type.kind === 'value';
    }
}

function eq(ctx: EvaluationContext, a: any, b: any): boolean { return a === b; }
function neq(ctx: EvaluationContext, a: any, b: any): boolean { return a !== b; }
function lt(ctx: EvaluationContext, a: any, b: any): boolean { return a < b; }
function gt(ctx: EvaluationContext, a: any, b: any): boolean { return a > b; }
function lteq(ctx: EvaluationContext, a: any, b: any): boolean { return a <= b; }
function gteq(ctx: EvaluationContext, a: any, b: any): boolean { return a >= b; }

function eqCollate(ctx: EvaluationContext, a: any, b: any, c: any): boolean { return c.compare(a, b) === 0; }
function neqCollate(ctx: EvaluationContext, a: any, b: any, c: any): boolean { return !eqCollate(ctx, a, b, c); }
function ltCollate(ctx: EvaluationContext, a: any, b: any, c: any): boolean { return c.compare(a, b) < 0; }
function gtCollate(ctx: EvaluationContext, a: any, b: any, c: any): boolean { return c.compare(a, b) > 0; }
function lteqCollate(ctx: EvaluationContext, a: any, b: any, c: any): boolean { return c.compare(a, b) <= 0; }
function gteqCollate(ctx: EvaluationContext, a: any, b: any, c: any): boolean { return c.compare(a, b) >= 0; }

/**
 * Special form for comparison operators, implementing the signatures:
 * - (T, T, ?Collator) => boolean
 * - (T, value, ?Collator) => boolean
 * - (value, T, ?Collator) => boolean
 *
 * For inequalities, T must be either value, string, or number. For ==/!=, it
 * can also be boolean or null.
 *
 * Equality semantics are equivalent to Javascript's strict equality (===/!==)
 * -- i.e., when the arguments' types don't match, == evaluates to false, != to
 * true.
 *
 * When types don't match in an ordering comparison, a runtime error is thrown.
 *
 * @private
 */
function makeComparison(op: ComparisonOperator, compareBasic: (EvaluationContext, any, any) => boolean, compareWithCollator: (EvaluationContext, any, any, any) => boolean): ExpressionRegistration {
    const isOrderComparison = op !== '==' && op !== '!=';

    // $FlowFixMe[method-unbinding]
    return class Comparison implements Expression {
        type: Type;
        lhs: Expression;
        rhs: Expression;
        collator: ?Expression;
        hasUntypedArgument: boolean;

        constructor(lhs: Expression, rhs: Expression, collator: ?Expression) {
            this.type = BooleanType;
            this.lhs = lhs;
            this.rhs = rhs;
            this.collator = collator;
            this.hasUntypedArgument = lhs.type.kind === 'value' || rhs.type.kind === 'value';
        }

        // $FlowFixMe[method-unbinding]
        static parse(args: $ReadOnlyArray<mixed>, context: ParsingContext): ?Expression {
            if (args.length !== 3 && args.length !== 4)
                return context.error(`Expected two or three arguments.`);

            const op: ComparisonOperator = (args[0]: any);

            let lhs = context.parse(args[1], 1, ValueType);
            if (!lhs) return null;
            if (!isComparableType(op, lhs.type)) {
                return context.concat(1).error(`"${op}" comparisons are not supported for type '${toString(lhs.type)}'.`);
            }
            let rhs = context.parse(args[2], 2, ValueType);
            if (!rhs) return null;
            if (!isComparableType(op, rhs.type)) {
                return context.concat(2).error(`"${op}" comparisons are not supported for type '${toString(rhs.type)}'.`);
            }

            if (
                lhs.type.kind !== rhs.type.kind &&
                lhs.type.kind !== 'value' &&
                rhs.type.kind !== 'value'
            ) {
                return context.error(`Cannot compare types '${toString(lhs.type)}' and '${toString(rhs.type)}'.`);
            }

            if (isOrderComparison) {
                // typing rules specific to less/greater than operators
                if (lhs.type.kind === 'value' && rhs.type.kind !== 'value') {
                    // (value, T)
                    lhs = new Assertion(rhs.type, [lhs]);
                } else if (lhs.type.kind !== 'value' && rhs.type.kind === 'value') {
                    // (T, value)
                    rhs = new Assertion(lhs.type, [rhs]);
                }
            }

            let collator = null;
            if (args.length === 4) {
                if (
                    lhs.type.kind !== 'string' &&
                    rhs.type.kind !== 'string' &&
                    lhs.type.kind !== 'value' &&
                    rhs.type.kind !== 'value'
                ) {
                    return context.error(`Cannot use collator to compare non-string types.`);
                }
                collator = context.parse(args[3], 3, CollatorType);
                if (!collator) return null;
            }

            return new Comparison(lhs, rhs, collator);
        }

        evaluate(ctx: EvaluationContext): boolean {
            const lhs = this.lhs.evaluate(ctx);
            const rhs = this.rhs.evaluate(ctx);

            if (isOrderComparison && this.hasUntypedArgument) {
                const lt = typeOf(lhs);
                const rt = typeOf(rhs);
                // check that type is string or number, and equal
                if (lt.kind !== rt.kind || !(lt.kind === 'string' || lt.kind === 'number')) {
                    throw new RuntimeError(`Expected arguments for "${op}" to be (string, string) or (number, number), but found (${lt.kind}, ${rt.kind}) instead.`);
                }
            }

            if (this.collator && !isOrderComparison && this.hasUntypedArgument) {
                const lt = typeOf(lhs);
                const rt = typeOf(rhs);
                if (lt.kind !== 'string' || rt.kind !== 'string') {
                    return compareBasic(ctx, lhs, rhs);
                }
            }

            return this.collator ?
                compareWithCollator(ctx, lhs, rhs, this.collator.evaluate(ctx)) :
                compareBasic(ctx, lhs, rhs);
        }

        eachChild(fn: (_: Expression) => void) {
            fn(this.lhs);
            fn(this.rhs);
            if (this.collator) {
                fn(this.collator);
            }
        }

        outputDefined(): boolean {
            return true;
        }

        serialize(): SerializedExpression {
            const serialized = [op];
            this.eachChild(child => { serialized.push(child.serialize()); });
            return serialized;
        }
    };
}

export const Equals: $Call<typeof makeComparison, '==', typeof eq, typeof eqCollate> = makeComparison('==', eq, eqCollate);
export const NotEquals: $Call<typeof makeComparison, '!=', typeof neq, typeof neqCollate> = makeComparison('!=', neq, neqCollate);
export const LessThan: $Call<typeof makeComparison, '<', typeof lt, typeof ltCollate> = makeComparison('<', lt, ltCollate);
export const GreaterThan: $Call<typeof makeComparison, '>', typeof gt, typeof gtCollate> = makeComparison('>', gt, gtCollate);
export const LessThanOrEqual: $Call<typeof makeComparison, '<=', typeof lteq, typeof lteqCollate> = makeComparison('<=', lteq, lteqCollate);
export const GreaterThanOrEqual: $Call<typeof makeComparison, '>=', typeof gteq, typeof gteqCollate> = makeComparison('>=', gteq, gteqCollate);
