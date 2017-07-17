// @flow

const {
    ParsingError,
    parseExpression
} = require('../expression');

const { typename } = require('../types');

import type { Type } from '../types';
import type { Expression, ParsingContext, Scope }  from '../expression';

class LetExpression implements Expression {
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

    typecheck(expected: Type, scope: Scope) {
        const bindings = [];
        for (const [name, value] of this.bindings) {
            const checkedValue = value.typecheck(typename('T'), scope);
            if (checkedValue.result === 'error') return checkedValue;
            bindings.push([name, checkedValue.expression]);
        }
        const nextScope = scope.concat(bindings);
        const checkedResult = this.result.typecheck(expected, nextScope);
        if (checkedResult.result === 'error') return checkedResult;
        return {
            result: 'success',
            expression: new LetExpression(this.key, bindings, checkedResult.expression)
        };
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

        return `(function (${names.join(', ')}) {
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

    visit(fn: (Expression) => void): void {
        fn(this);
        for (const binding of this.bindings) {
            binding[1].visit(fn);
        }
        this.result.visit(fn);
    }

    static parse(args: Array<mixed>, context: ParsingContext) {
        if (args.length < 3)
            throw new ParsingError(context.key, `Expected at least 3 arguments, but found ${args.length} instead.`);

        const bindings: Array<[string, Expression]> = [];
        for (let i = 0; i < args.length - 1; i += 2) {
            const name = args[i];
            const key = context.path.concat(i + 1).join('.');
            if (typeof name !== 'string')
                throw new ParsingError(key, `Expected string, but found ${typeof name} instead`);

            if (context.definitions[name])
                throw new ParsingError(key, `"${name}" is reserved, so it cannot not be used as a "let" binding.`);

            const value = parseExpression(args[i + 1], context.concat(i + 2, 'let.binding'));

            bindings.push([name, value]);
        }
        const resultContext = context.concat(args.length, 'let.result', bindings);
        const result = parseExpression(args[args.length - 1], resultContext);
        return new this(context.key, bindings, result);
    }
}

module.exports = LetExpression;
