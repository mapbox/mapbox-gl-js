// @flow

const { parseExpression } = require('../expression');

import type { Expression } from '../expression';
import type { Type } from '../types';

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
        let outputType;
        const parsedArgs = [];
        for (const arg of args) {
            const argContext = context.concat(1 + parsedArgs.length, 'coalesce');
            const parsed = parseExpression(arg, argContext, outputType);
            if (!parsed) return null;
            outputType = parsed.type;
            parsedArgs.push(parsed);
        }
        return new Coalesce(context.key, parsedArgs);
    }

    compile() {
        return `this.coalesce(${this.args.map(a => `function () { return ${a.compile()} }.bind(this)`).join(', ')})`;
    }

    serialize() {
        return ['coalesce'].concat(this.args.map(a => a.serialize()));
    }

    accept(visitor: Visitor<Expression>) {
        visitor.visit(this);
        for (const arg of this.args) {
            arg.accept(visitor);
        }
    }
}

module.exports = Coalesce;
