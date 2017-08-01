// @flow

const assert = require('assert');
const { ParsingError, parseExpression } = require('../expression');
const { match } = require('../types');
const { typeOf } = require('../values');

import type { Expression, Scope } from '../expression';
import type { Type, TypeError } from '../types';

type Branches = Array<[Array<null | number | string | boolean>, Expression]>;

class MatchExpression implements Expression {
    key: string;
    type: Type;
    inputType: Type;

    input: Expression;
    branches: Branches;
    otherwise: Expression;

    constructor(key: string, inputType: Type, input: Expression, branches: Branches, otherwise: Expression) {
        this.key = key;
        this.type = branches[0][1].type;
        this.inputType = inputType;
        this.input = input;
        this.branches = branches;
        this.otherwise = otherwise;
    }

    static parse(args, context) {
        args = args.slice(1);
        if (args.length < 2)
            throw new ParsingError(context.key, `Expected at least 2 arguments, but found only ${args.length}.`);
        if (args.length % 2 !== 0)
            throw new ParsingError(context.key, `Expected an even number of arguments.`);

        const input = parseExpression(args[0], context.concat(1, 'match'));

        let inputType;
        const branches = [];
        for (let i = 1; i < args.length - 1; i += 2) {
            let labels = args[i];
            const value = args[i + 1];

            if (!Array.isArray(labels)) {
                labels = [labels];
            }

            if (labels.length === 0) {
                throw new ParsingError(`${context.key}[${i + 1}]`, 'Expected at least one branch label.');
            }

            for (const label of labels) {
                if (label !== null && typeof label !== 'number' && typeof label !== 'string' && typeof label !== 'boolean') {
                    throw new ParsingError(`${context.key}[${i + 1}]`, `Branch labels must be null, numbers, strings, or booleans.`);
                } else if (!inputType) {
                    inputType = typeOf(label);
                } else {
                    const error = match(inputType, typeOf(label));
                    if (error) {
                        throw new ParsingError(`${context.key}[${i + 1}]`, error);
                    }
                }
            }

            branches.push([labels, parseExpression(value, context.concat(i + 1, 'match'))]);
        }

        const otherwise = parseExpression(args[args.length - 1], context.concat(args.length, 'match'));

        assert(inputType);
        return new MatchExpression(context.key, (inputType: any), input, branches, otherwise);
    }

    typecheck(scope: Scope, errors: Array<TypeError>) {
        const input = this.input.typecheck(scope, errors);
        if (!input) return null;
        if (match(this.inputType, input.type, input.key, errors))
            return null;

        let outputType: Type = (null: any);
        const branches = [];
        for (const [key, expression] of this.branches) {
            const result = expression.typecheck(scope, errors);
            if (!result) return null;

            if (!outputType) {
                outputType = result.type;
            } else if (match(outputType, result.type, result.key, errors)) {
                return null;
            }

            branches.push([key, result]);
        }

        const otherwise = this.otherwise.typecheck(scope, errors);
        if (!otherwise) return null;
        if (match(outputType, otherwise.type, otherwise.key, errors)) {
            return null;
        }

        return new MatchExpression(this.key, this.inputType, input, branches, otherwise);
    }

    compile() {
        const input = this.input.compile();
        const outputs = [`function () { return ${this.otherwise.compile()} }.bind(this)`];
        const lookup = {};

        for (const [labels, expression] of this.branches) {
            for (const label of labels) {
                lookup[`${typeOf(label).name}-${String(label)}`] = outputs.length;
            }
            outputs.push(`function () { return ${expression.compile()} }.bind(this)`);
        }

        return `(function () {
            var o = [${outputs.join(', ')}];
            var l = ${JSON.stringify(lookup)};
            var i = ${input};
            return o[l[this.typeOf(i) + '-' + i] || 0]();
        }.bind(this))()`;
    }

    serialize() {
        const result = ['match'];
        result.push(this.input.serialize());
        for (const [labels, expression] of this.branches) {
            result.push(labels);
            result.push(expression.serialize());
        }
        result.push(this.otherwise.serialize());
        return result;
    }

    visit(fn: (Expression) => void) {
        fn(this);
        this.input.visit(fn);
        for (const [ , expression] of this.branches) {
            expression.visit(fn);
        }
        this.otherwise.visit(fn);
    }
}

module.exports = MatchExpression;
