// @flow

const {
    ValueType,
    BooleanType,
} = require('../types');
const {toString} = require('../types');

import type { Expression } from '../expression';
import type EvaluationContext from '../evaluation_context';
import type ParsingContext from '../parsing_context';
import type { Type } from '../types';

function eq(ctx) { return this.lhs.evaluate(ctx) === this.rhs.evaluate(ctx); }
function ne(ctx) { return this.lhs.evaluate(ctx) !== this.rhs.evaluate(ctx); }

function isComparableType(type: Type) {
    return type.kind === 'string' ||
        type.kind === 'number' ||
        type.kind === 'boolean' ||
        type.kind === 'null';
}

/**
 * Special form for ==, !=, implementing the following signatures:
 * - (T1: Comparable, T2: Comparable) => boolean { T1 == T2 }
 * - (Comparable, value) => boolean
 * - (value, Comparable) => boolean
 *
 * Where Comparable = string | number | boolean | null.
 *
 * Evaluation semantics for the value cases are equivalent to Javascript's
 * strict equality (===/!==) -- i.e., when the value argument's type doesn't
 * match that of the Comparable argument, == evaluates to false, != to true.
 *
 * @private
 */
class Equals implements Expression {
    type: Type;
    lhs: Expression;
    rhs: Expression;
    evaluate: (EvaluationContext) => any;

    constructor(op: '==' | '!=', lhs: Expression, rhs: Expression) {
        this.type = BooleanType;
        this.lhs = lhs;
        this.rhs = rhs;
        this.evaluate = op === '==' ? eq : ne;
    }

    static parse(args: Array<mixed>, context: ParsingContext): ?Expression {
        if (args.length !== 3)
            return context.error(`Expected two arguments.`);

        const op: '==' | '!=' = (args[0]: any);

        const lhs = context.parse(args[1], 1, ValueType);
        if (!lhs) return null;
        const rhs = context.parse(args[2], 2, ValueType);
        if (!rhs) return null;

        if (!isComparableType(lhs.type) && !isComparableType(rhs.type)) {
            return context.error(`Expected at least one argument to be a string, number, boolean, or null, but found (${toString(lhs.type)}, ${toString(rhs.type)}) instead.`);
        }

        if (lhs.type.kind !== rhs.type.kind && lhs.type.kind !== 'value' && rhs.type.kind !== 'value') {
            return context.error(`Cannot compare ${toString(lhs.type)} and ${toString(rhs.type)}.`);
        }

        return new Equals(op, lhs, rhs);
    }

    eachChild(fn: (Expression) => void) {
        fn(this.lhs);
        fn(this.rhs);
    }

    possibleOutputs() {
        return [true, false];
    }
}

module.exports = Equals;
