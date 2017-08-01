// @flow

const { ParsingError, parseExpression } = require('../expression');
const { match, BooleanType } = require('../types');

import type { Expression, Scope } from '../expression';
import type { Type, TypeError } from '../types';

type Branches = Array<[Expression, Expression]>;

class CaseExpression implements Expression {
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

    typecheck(scope: Scope, errors: Array<TypeError>) {
        let result;

        let outputType: Type = (null: any);
        for (const [test, expression] of this.branches) {
            result = test.typecheck(scope, errors);
            if (!result) return null;
            if (match(BooleanType, result.type, result.key, errors))
                return null;

            result = expression.typecheck(scope, errors);
            if (!result) return null;
            if (!outputType) {
                outputType = result.type;
            } else {
                if (match(outputType, result.type, result.key, errors))
                    return null;
            }
        }

        result = this.otherwise.typecheck(scope, errors);
        if (!result) return null;
        if (match(outputType, result.type, result.key, errors))
            return null;

        this.type = outputType;
        return this;
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
