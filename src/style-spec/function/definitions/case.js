// @flow

const { ParsingError, parseExpression } = require('../expression');
const { BooleanType, typename } = require('../types');

import type { Expression, Scope } from '../expression';
import type { Type } from '../types';

type Branches = Array<[Expression, Expression]>;

class CaseExpression implements Expression {
    key: string;
    type: Type;

    branches: Branches;
    otherwise: Expression;

    constructor(key: string, branches: Branches, otherwise: Expression) {
        this.key = key;
        this.type = typename('T');
        this.branches = branches;
        this.otherwise = otherwise;
    }

    static parse(args, context) {
        if (args.length < 3)
            throw new ParsingError(context.key, `Expected at least 3 arguments, but found only ${args.length}.`);
        if (args.length % 2 === 0)
            throw new ParsingError(context.key, `Expected an odd number of arguments.`);

        const branches = [];
        for (let i = 0; i < args.length - 1; i += 2) {
            branches.push([
                parseExpression(args[i], context.concat(i, 'case')),
                parseExpression(args[i + 1], context.concat(i + 1, 'case'))]);
        }

        const otherwise = parseExpression(args[args.length - 1], context.concat(args.length, 'match'));

        return new CaseExpression(context.key, branches, otherwise);
    }

    typecheck(expected: Type, scope: Scope) {
        let result;

        for (const [test, expression] of this.branches) {
            result = test.typecheck(BooleanType, scope);
            if (result.result === 'error') {
                return result;
            }

            result = expression.typecheck(expected || typename('T'), scope);
            if (result.result === 'error') {
                return result;
            }

            expected = result.expression.type;
        }

        result = this.otherwise.typecheck(expected, scope);
        if (result.result === 'error') {
            return result;
        }

        this.type = result.expression.type;

        return {
            result: 'success',
            expression: this
        };
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

    visit(fn: (Expression) => void) {
        fn(this);
        for (const [test, expression] of this.branches) {
            test.visit(fn);
            expression.visit(fn);
        }
        this.otherwise.visit(fn);
    }
}

module.exports = CaseExpression;
