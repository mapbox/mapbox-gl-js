// @flow

const assert = require('assert');
const { parseExpression } = require('../expression');
const { match } = require('../types');

import type { Expression, Scope } from '../expression';
import type { Type, TypeError } from '../types';

class Coalesce implements Expression {
    key: string;
    type: Type;
    args: Array<Expression>;

    constructor(key: string, args: Array<Expression>) {
        this.key = key;
        this.type = args[0].type;
        this.args = args;
    }

    static parse(args, context) {
        args = args.slice(1);
        const parsedArgs = [];
        for (const arg of args) {
            parsedArgs.push(parseExpression(arg, context.concat(1 + parsedArgs.length, 'coalesce')));
        }
        return new Coalesce(context.key, parsedArgs);
    }

    typecheck(scope: Scope, errors: Array<TypeError>) {
        let outputType;
        const checkedArgs = [];
        for (const arg of this.args) {
            const result = arg.typecheck(scope, errors);
            if (!result) return null;
            if (!outputType) {
                outputType = result.type;
            } else {
                if (match(outputType, result.type, result.key, errors))
                    return null;
            }
            checkedArgs.push(result);
        }
        assert(outputType);
        return new Coalesce(this.key, checkedArgs);
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

module.exports = Coalesce;
