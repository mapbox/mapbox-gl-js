// @flow

const { ParsingError, parseExpression } = require('../expression');
const { match, BooleanType } = require('../types');

import type { Expression, Scope } from '../expression';
import type { Type, TypeError } from '../types';

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

        return new Case(context.key, branches, otherwise);
    }

    typecheck(scope: Scope, errors: Array<TypeError>) {
        let outputType: Type = (null: any);
        const checkedBranches = [];
        for (const [test, expression] of this.branches) {
            const checkedTest = test.typecheck(scope, errors);
            if (!checkedTest) return null;
            if (match(BooleanType, checkedTest.type, checkedTest.key, errors))
                return null;

            const checkedResult = expression.typecheck(scope, errors);
            if (!checkedResult) return null;
            if (!outputType) {
                outputType = checkedResult.type;
            } else {
                if (match(outputType, checkedResult.type, checkedResult.key, errors))
                    return null;
            }
            checkedBranches.push([checkedTest, checkedResult]);
        }

        const checkedOtherwise = this.otherwise.typecheck(scope, errors);
        if (!checkedOtherwise) return null;
        if (match(outputType, checkedOtherwise.type, checkedOtherwise.key, errors))
            return null;

        return new Case(this.key, checkedBranches, checkedOtherwise);
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
