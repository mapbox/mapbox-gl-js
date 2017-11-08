// @flow

const assert = require('assert');

import type { Expression } from '../expression';
import type ParsingContext from '../parsing_context';
import type EvaluationContext from '../evaluation_context';
import type { Type } from '../types';

class Coalesce implements Expression {
    type: Type;
    args: Array<Expression>;

    constructor(type: Type, args: Array<Expression>) {
        this.type = type;
        this.args = args;
    }

    static parse(args: Array<mixed>, context: ParsingContext) {
        if (args.length < 2) {
            return context.error("Expectected at least one argument.");
        }
        let outputType: Type = (null: any);
        if (context.expectedType && context.expectedType.kind !== 'value') {
            outputType = context.expectedType;
        }
        const parsedArgs = [];
        for (const arg of args.slice(1)) {
            const parsed = context.parse(arg, 1 + parsedArgs.length, outputType);
            if (!parsed) return null;
            outputType = outputType || parsed.type;
            parsedArgs.push(parsed);
        }
        assert(outputType);
        return new Coalesce((outputType: any), parsedArgs);
    }

    evaluate(ctx: EvaluationContext) {
        let result = null;
        for (const arg of this.args) {
            result = arg.evaluate(ctx);
            if (result !== null) break;
        }
        return result;
    }

    eachChild(fn: (Expression) => void) {
        this.args.forEach(fn);
    }
}

module.exports = Coalesce;
