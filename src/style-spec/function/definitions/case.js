// @flow

const assert = require('assert');
const parseExpression = require('../parse_expression');
const { BooleanType } = require('../types');

import type { Expression, ParsingContext, CompilationContext } from '../expression';
import type { Type } from '../types';

type Branches = Array<[Expression, Expression]>;

class Case implements Expression {
    key: string;
    type: Type;

    branches: Branches;
    otherwise: Expression;

    constructor(key: string, type: Type, branches: Branches, otherwise: Expression) {
        this.key = key;
        this.type = type;
        this.branches = branches;
        this.otherwise = otherwise;
    }

    static parse(args: Array<mixed>, context: ParsingContext) {
        if (args.length < 4)
            return context.error(`Expected at least 3 arguments, but found only ${args.length - 1}.`);
        if (args.length % 2 !== 0)
            return context.error(`Expected an odd number of arguments.`);

        let outputType: ?Type;
        if (context.expectedType && context.expectedType.kind !== 'Value') {
            outputType = context.expectedType;
        }

        const branches = [];
        for (let i = 1; i < args.length - 1; i += 2) {
            const test = parseExpression(args[i], context.concat(i, BooleanType));
            if (!test) return null;

            const result = parseExpression(args[i + 1], context.concat(i + 1, outputType));
            if (!result) return null;

            branches.push([test, result]);

            outputType = outputType || result.type;
        }

        const otherwise = parseExpression(args[args.length - 1], context.concat(args.length - 1, outputType));
        if (!otherwise) return null;

        assert(outputType);
        return new Case(context.key, (outputType: any), branches, otherwise);
    }

    compile(ctx: CompilationContext) {
        const result = [];
        for (const [test, expression] of this.branches) {
            result.push(`(${ctx.compileAndCache(test)}) ? (${ctx.compileAndCache(expression)})`);
        }
        result.push(`(${ctx.compileAndCache(this.otherwise)})`);
        return result.join(' : ');
    }

    serialize() {
        const result = ['case'];
        for (const [test, expression] of this.branches) {
            result.push(test.serialize());
            result.push(expression.serialize());
        }
        result.push(this.otherwise.serialize());
        return result;
    }

    accept(visitor: Visitor<Expression>) {
        visitor.visit(this);
        for (const [test, expression] of this.branches) {
            test.accept(visitor);
            expression.accept(visitor);
        }
        this.otherwise.accept(visitor);
    }
}

module.exports = Case;
