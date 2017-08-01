// @flow

const assert = require('assert');
const { parseExpression } = require('../expression');
const { match } = require('../types');

import type { Expression, Scope } from '../expression';
import type { Type, TypeError } from '../types';

class CoalesceExpression implements Expression {
    key: string;
    type: Type;
    args: Array<Expression>;

    constructor(key: string, args: Array<Expression>) {
        this.key = key;
        this.type = args[0].type;
        this.args = args;
    }

    static parse(args, context) {
        const parsedArgs = [];
        for (const arg of args) {
            parsedArgs.push(parseExpression(arg, context.concat(1 + parsedArgs.length, 'coalesce')));
        }
        return new CoalesceExpression(context.key, parsedArgs);
    }

    typecheck(scope: Scope, errors: Array<TypeError>) {
        let outputType;
        for (const arg of this.args) {
            const result = arg.typecheck(scope, errors);
            if (!result) return null;
            if (!outputType) {
                outputType = result.type;
            } else {
                if (match(outputType, result.type, result.key, errors))
                    return null;
            }
        }

        assert(outputType);
        this.type = (outputType: any);
        return this;
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
