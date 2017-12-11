// @flow

const {
    ValueType,
    BooleanType,
} = require('../types');
const {toString, checkSubtype} = require('../types');

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
 * Special form for error-coalescing coercion expressions "to-number",
 * "to-color".  Since these coercions can fail at runtime, they accept multiple
 * arguments, only evaluating one at a time until one succeeds.
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

        if (checkSubtype(lhs.type, rhs.type) && checkSubtype(rhs.type, lhs.type)) {
            return context.error(`Cannot compare ${toString(lhs.type)} and ${toString(rhs.type)}.`);
        }

        return new Equals(op, lhs, rhs);
    }

    eachChild(fn: (Expression) => void) {
        fn(this.lhs);
        fn(this.rhs);
    }

    possibleOutputs() {
        return this.lhs.possibleOutputs().concat(this.rhs.possibleOutputs());
    }
}

module.exports = Equals;
