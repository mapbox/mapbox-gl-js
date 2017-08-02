// @flow

const { parseExpression } = require('../expression');
import type { Type } from '../types';
import type { Expression, ParsingContext }  from '../expression';

class Let implements Expression {
    key: string;
    type: Type;
    bindings: Array<[string, Expression]>;
    result: Expression;

    constructor(key: string, bindings: Array<[string, Expression]>, result: Expression) {
        this.key = key;
        this.type = result.type;
        this.bindings = [].concat(bindings);
        this.result = result;
    }

    compile() {
        const names = [];
        const values = [];
        const errors = [];
        for (const [name, expression] of this.bindings) {
            names.push(name);
            const value = expression.compile();
            if (Array.isArray(value)) {
                errors.push.apply(errors, value);
            } else {
                values.push(value);
            }
        }

        const result = this.result.compile();

        return `(function (${names.map(Let.escape).join(', ')}) {
            return ${result};
        }.bind(this))(${values.join(', ')})`;
    }

    serialize() {
        const serialized = ['let'];
        for (const [name, expression] of this.bindings) {
            serialized.push(name, expression.serialize());
        }
        serialized.push(this.result.serialize());
        return serialized;
    }

    accept(visitor: Visitor<Expression>) {
        visitor.visit(this);
        for (const binding of this.bindings) {
            binding[1].accept(visitor);
        }
        this.result.accept(visitor);
    }

    static parse(args: Array<mixed>, context: ParsingContext) {
        args = args.slice(1);
        if (args.length < 3)
            return context.error(`Expected at least 3 arguments, but found ${args.length} instead.`);

        const bindings: Array<[string, Expression]> = [];
        for (let i = 0; i < args.length - 1; i += 2) {
            const name = args[i];
            if (typeof name !== 'string')
                return context.error(`Expected string, but found ${typeof name} instead`, i + 1);

            if (context.definitions[name])
                return context.error(`"${name}" is reserved, so it cannot not be used as a "let" binding.`, i + 1);

            const value = parseExpression(args[i + 1], context.concat(i + 2, 'let.binding'));
            if (!value) return null;

            bindings.push([name, value]);
        }

        const resultContext = context.concat(args.length, 'let.result', bindings);
        const result = parseExpression(args[args.length - 1], resultContext);
        if (!result) return null;

        return new Let(context.key, bindings, result);
    }

    static escape(name: string) :string {
        return `_${name.replace(/[^a-zA-Z_a-zA-Z_0-9]/g, '_')}`;
    }
}

module.exports = Let;
