// @flow

const assert = require('assert');
const parseExpression = require('../parse_expression');

import type { Expression, ParsingContext } from '../expression';
import type { Type } from '../types';

class Coalesce implements Expression {
    key: string;
    type: Type;
    args: Array<Expression>;

    constructor(key: string, type: Type, args: Array<Expression>) {
        this.key = key;
        this.type = type;
        this.args = args;
    }

    static parse(args: Array<mixed>, context: ParsingContext) {
        if (args.length < 2) {
            return context.error("Expectected at least one argument.");
        }
        let outputType: Type = (null: any);
        if (context.expectedType && context.expectedType.kind !== 'Value') {
            outputType = context.expectedType;
        }
        const parsedArgs = [];
        for (const arg of args.slice(1)) {
            const argContext = context.concat(1 + parsedArgs.length, outputType);
            const parsed = parseExpression(arg, argContext);
            if (!parsed) return null;
            outputType = outputType || parsed.type;
            parsedArgs.push(parsed);
        }
        assert(outputType);
        return new Coalesce(context.key, (outputType: any), parsedArgs);
    }

    compile() {
        const compiledArgs = [];
        for (let i = 0; i < this.args.length - 1; i++) {
            compiledArgs.push(`try {
                var result = ${this.args[i].compile()};
                if (result !== null) return result;
            } catch (e) {}`);
        }
        compiledArgs.push(`return ${this.args[this.args.length - 1].compile()};`);
        return `(function coalesce() {\n${compiledArgs.join('\n')}\n})()`;
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
