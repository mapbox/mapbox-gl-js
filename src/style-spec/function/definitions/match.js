// @flow

const assert = require('assert');
const { parseExpression, match } = require('../expression');
const { typeOf } = require('../values');

import type { Expression } from '../expression';
import type { Type } from '../types';

type Branches = Array<[Array<null | number | string | boolean>, Expression]>;

class Match implements Expression {
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
            return context.error(`Expected at least 2 arguments, but found only ${args.length}.`);
        if (args.length % 2 !== 0)
            return context.error(`Expected an even number of arguments.`);

        let inputType;
        let outputType;
        const branches = [];
        for (let i = 1; i < args.length - 1; i += 2) {
            let labels = args[i];
            const value = args[i + 1];

            if (!Array.isArray(labels)) {
                labels = [labels];
            }

            const labelContext = context.concat(i + 1, 'match');
            if (labels.length === 0) {
                return labelContext.error('Expected at least one branch label.');
            }

            for (const label of labels) {
                if (label !== null && typeof label !== 'number' && typeof label !== 'string' && typeof label !== 'boolean') {
                    return labelContext.error(`Branch labels must be null, numbers, strings, or booleans.`);
                } else if (!inputType) {
                    inputType = typeOf(label);
                } else if (match(inputType, typeOf(label), labelContext)) {
                    return null;
                }
            }

            const result = parseExpression(value, context.concat(i + 1, 'match'), outputType);
            if (!result) return null;
            outputType = result.type;

            branches.push([labels, result]);
        }

        const input = parseExpression(args[0], context.concat(1, 'match'), inputType);
        if (!input) return null;

        const otherwise = parseExpression(args[args.length - 1], context.concat(args.length, 'match'), outputType);
        if (!otherwise) return null;

        assert(inputType && outputType);
        return new Match(context.key, (inputType: any), input, branches, otherwise);
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

    accept(visitor: Visitor<Expression>) {
        visitor.visit(this);
        this.input.accept(visitor);
        for (const [ , expression] of this.branches) {
            expression.accept(visitor);
        }
        this.otherwise.accept(visitor);
    }
}

module.exports = Match;
