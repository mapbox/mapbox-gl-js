// @flow

import { toString, ValueType, BooleanType, CollatorType } from '../types';
import Assertion from './assertion';

import type { Expression } from '../expression';
import type EvaluationContext from '../evaluation_context';
import type ParsingContext from '../parsing_context';
import type { Type } from '../types';

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


function eq(ctx, a, b) { return a.evaluate(ctx) === b.evaluate(ctx); }
function neq(ctx, a, b) { return a.evaluate(ctx) !== b.evaluate(ctx); }
function lt(ctx, a, b) { return a.evaluate(ctx) < b.evaluate(ctx); }
function gt(ctx, a, b) { return a.evaluate(ctx) > b.evaluate(ctx); }
function lteq(ctx, a, b) { return a.evaluate(ctx) <= b.evaluate(ctx); }
function gteq(ctx, a, b) { return a.evaluate(ctx) >= b.evaluate(ctx); }

function eqCollate(ctx, a, b, c) { return c.evaluate(ctx).compare(a.evaluate(ctx), b.evaluate(ctx)) === 0; }
function neqCollate(ctx, a, b, c) { return !eqCollate(ctx, a, b, c); }
function ltCollate(ctx, a, b, c) { return c.evaluate(ctx).compare(a.evaluate(ctx), b.evaluate(ctx)) < 0; }
function gtCollate(ctx, a, b, c) { return c.evaluate(ctx).compare(a.evaluate(ctx), b.evaluate(ctx)) > 0; }
function lteqCollate(ctx, a, b, c) { return c.evaluate(ctx).compare(a.evaluate(ctx), b.evaluate(ctx)) <= 0; }
function gteqCollate(ctx, a, b, c) { return c.evaluate(ctx).compare(a.evaluate(ctx), b.evaluate(ctx)) >= 0; }

/**
 * Special form for comparison operators, implementing the signatures:
 * - (T, T, ?Collator) => boolean
 * - (T, value, ?Collator) => boolean
 * - (value, T, ?Collator) => boolean
 *
 * For inequalities, T must be either string or number. For ==/!=, it can also
 * be boolean or null.
 *
 * Equality semantics are equivalent to Javascript's strict equality (===/!==)
 * -- i.e., when the arguments' types don't match, == evaluates to false, != to
 * true.
 *
 * When types don't match in an inequality, a runtime error is thrown.
 *
 * @private
 */
function makeComparison(op: ComparisonOperator, compareBasic, compareWithCollator) {
    return class Comparison implements Expression {
        type: Type;
        lhs: Expression;
        rhs: Expression;
        collator: ?Expression;

        constructor(lhs: Expression, rhs: Expression, collator: ?Expression) {
            this.type = BooleanType;
            this.lhs = lhs;
            this.rhs = rhs;
            this.collator = collator;
        }

        static parse(args: Array<mixed>, context: ParsingContext): ?Expression {
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

            if (!(
                lhs.type.kind === rhs.type.kind ||
                lhs.type.kind === 'value' ||
                rhs.type.kind === 'value'
            )) {
                return context.error(`Cannot compare types '${toString(lhs.type)}' and '${toString(rhs.type)}'.`);
            }

            if (op !== '==' && op !== '!=') {
                // typing rules specific to less/greater than operators
                if (lhs.type.kind === 'value' && rhs.type.kind !== 'value') {
                    // (value, T)
                    lhs = new Assertion(rhs.type, [lhs]);
                } else if (lhs.type.kind !== 'value' && rhs.type.kind === 'value') {
                    // (T, value)
                    rhs = new Assertion(lhs.type, [rhs]);
                } else if (lhs.type.kind === 'value' && rhs.type.kind === 'value') {
                    // (value, value)
                    return context.error(`Expected at least one argument to be a string, number, boolean, or null, but found (${toString(lhs.type)}, ${toString(rhs.type)}) instead.`);
                }
            }

            let collator = null;
            if (args.length === 4) {
                if (lhs.type.kind !== 'string' && rhs.type.kind !== 'string') {
                    return context.error(`Cannot use collator to compare non-string types.`);
                }
                collator = context.parse(args[3], 3, CollatorType);
                if (!collator) return null;
            }

            return new Comparison(lhs, rhs, collator);
        }

        evaluate(ctx: EvaluationContext) {
            return this.collator ?
                compareWithCollator(ctx, this.lhs, this.rhs, this.collator) :
                compareBasic(ctx, this.lhs, this.rhs);
        }

        eachChild(fn: (Expression) => void) {
            fn(this.lhs);
            fn(this.rhs);
            if (this.collator) {
                fn(this.collator);
            }
        }

        possibleOutputs() {
            return [true, false];
        }

        serialize() {
            const serialized = [op];
            this.eachChild(child => { serialized.push(child.serialize()); });
            return serialized;
        }
    };
}

export const Equals = makeComparison('==', eq, eqCollate);
export const NotEquals = makeComparison('!=', neq, neqCollate);
export const LessThan = makeComparison('<', lt, ltCollate);
export const GreaterThan = makeComparison('>', gt, gtCollate);
export const LessThanOrEqual = makeComparison('<=', lteq, lteqCollate);
export const GreaterThanOrEqual = makeComparison('>=', gteq, gteqCollate);
