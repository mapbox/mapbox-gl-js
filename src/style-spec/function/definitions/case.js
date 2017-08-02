// @flow

const { parseExpression } = require('../expression');
const { BooleanType } = require('../types');

import type { Expression } from '../expression';
import type { Type } from '../types';

type Branches = Array<[Expression, Expression]>;

class Case implements Expression {
    key: string;
    type: Type;

    branches: Branches;
    otherwise: Expression;

    constructor(key: string, branches: Branches, otherwise: Expression) {
        this.key = key;
        this.type = branches[0][1].type;
        this.branches = branches;
        this.otherwise = otherwise;
    }

    static parse(args, context) {
        args = args.slice(1);
        if (args.length < 3)
            return context.error(`Expected at least 3 arguments, but found only ${args.length}.`);
        if (args.length % 2 === 0)
            return context.error(`Expected an odd number of arguments.`);

        let outputType: Type = (null: any);

        const branches = [];
        for (let i = 0; i < args.length - 1; i += 2) {
            const test = parseExpression(args[i], context.concat(i, 'case'), BooleanType);
            if (!test) return null;

            const result = parseExpression(args[i + 1], context.concat(i + 1, 'case'), outputType);
            if (!result) return null;

            branches.push([test, result]);

            outputType = result.type;
        }

        const otherwise = parseExpression(args[args.length - 1], context.concat(args.length, 'case'), outputType);
        if (!otherwise) return null;

        return new Case(context.key, branches, otherwise);
    }

    compile() {
        const result = [];
        for (const [test, expression] of this.branches) {
            result.push(`(${test.compile()}) ? (${expression.compile()})`);
        }
        result.push(`(${this.otherwise.compile()})`);
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
