// @flow

const { parseExpression } = require('../expression');
const { typename } = require('../types');

import type { Expression, Scope } from '../expression';
import type { Type } from '../types';

class CoalesceExpression implements Expression {
    key: string;
    type: Type;
    args: Array<Expression>;

    constructor(key: string, args: Array<Expression>) {
        this.key = key;
        this.type = typename('T');
        this.args = args;
    }

    static parse(args, context) {
        const parsedArgs = [];
        for (const arg of args) {
            parsedArgs.push(parseExpression(arg, context.concat(1 + parsedArgs.length, 'coalesce')));
        }
        return new CoalesceExpression(context.key, parsedArgs);
    }

    typecheck(expected: Type, scope: Scope) {
        for (const arg of this.args) {
            const result = arg.typecheck(expected || typename('T'), scope);
            if (result.result === 'error') {
                return result;
            }
            expected = result.expression.type;
        }

        this.type = expected;
        return {
            result: 'success',
            expression: this
        };
    }

    compile() {
        return `this.coalesce(${this.args.map(a => `function () { return ${a.compile()} }.bind(this)`).join(', ')})`;
    }

    serialize() {
        return ['coalesce'].concat(this.args.map(a => a.serialize()));
    }

    visit(fn: (Expression) => void) {
        fn(this);
        for (const arg of this.args) {
            arg.visit(fn);
        }
    }
}

module.exports = CoalesceExpression;
