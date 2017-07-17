// @flow

const { typename, match } = require('./types');

import type { Type } from './types';

export type TypeError = {|
    error: string,
    key: string
|}

export type TypecheckResult = {|
    result: 'success',
    expression: Expression
|} | {|
    result: 'error',
    errors: Array<TypeError>
|}

/*::
export interface Expression {
    key: string;
    type: Type;

    static parse(args: Array<mixed>, context: ParsingContext): Expression;

    typecheck(expected: Type, scope: Scope): TypecheckResult;
    compile(): string;

    serialize(): any;
    visit(fn: (Expression) => void): void;
}
*/

class ParsingError extends Error {
    key: string;
    constructor(key: string, message: string) {
        super(message);
        this.key = key;
    }
}

class Scope {
    parent: ?Scope;
    bindings: {[string]: Expression};
    constructor(parent?: Scope, bindings: Array<[string, Expression]> = []) {
        this.parent = parent;
        this.bindings = {};
        for (const [name, expression] of bindings) {
            this.bindings[name] = expression;
        }
    }

    concat(bindings: Array<[string, Expression]>) {
        return new Scope(this, bindings);
    }

    get(name: string): Expression {
        if (this.bindings[name]) { return this.bindings[name]; }
        if (this.parent) { return this.parent.get(name); }
        throw new Error(`${name} not found in scope.`);
    }

    has(name: string): boolean {
        if (this.bindings[name]) return true;
        return this.parent ? this.parent.has(name) : false;
    }
}

class ParsingContext {
    key: string;
    path: Array<number>;
    ancestors: Array<string>;
    definitions: {[string]: Class<Expression>};
    scope: Scope;
    constructor(definitions: *, path: Array<number> = [], ancestors: * = [], scope: Scope = new Scope()) {
        this.definitions = definitions;
        this.path = path;
        this.key = path.map(part => `[${part}]`).join('');
        this.ancestors = ancestors;
        this.scope = scope;
    }

    concat(index?: number, expressionName?: string, bindings?: Array<[string, Expression]>) {
        const path = typeof index === 'number' ? this.path.concat(index) : this.path;
        const ancestors = expressionName ? this.ancestors.concat(expressionName) : this.ancestors;
        const scope = bindings ? this.scope.concat(bindings) : this.scope;
        return new ParsingContext(this.definitions, path, ancestors, scope);
    }
}

class Reference implements Expression {
    key: string;
    type: Type;
    name: string;

    constructor(key: string, name: string, type: Type) {
        if (!/^[a-zA-Z_]+[a-zA-Z_0-9]*$/.test(name))
            throw new ParsingError(key, `Invalid identifier ${name}.`);
        this.key = key;
        this.type = type;
        this.name = name;
    }

    typecheck(expected: Type, scope: Scope) {
        const referee = scope.get(this.name);
        const error = match(expected, referee.type);
        if (error) return { result: 'error', errors: [{key: this.key, error }] };
        return {
            result: 'success',
            expression: new Reference(this.key, this.name, referee.type)
        };
    }

    compile() { return this.name; }

    serialize() {
        return [this.name];
    }

    visit(fn: (Expression) => void) { fn(this); }
}

function parseExpression(expr: mixed, context: ParsingContext) : Expression {
    const key = context.key;

    if (expr === null || typeof expr === 'string' || typeof expr === 'boolean' || typeof expr === 'number') {
        expr = ['literal', expr];
    }

    if (Array.isArray(expr)) {
        if (expr.length === 0) {
            throw new ParsingError(key, `Expected an array with at least one element. If you wanted a literal array, use ["literal", []].`);
        }

        const op = expr[0];
        if (typeof op !== 'string') {
            throw new ParsingError(`${key}[0]`, `Expression name must be a string, but found ${typeof op} instead. If you wanted a literal array, use ["literal", [...]].`);
        } else if (context.scope.has(op)) {
            return new Reference(context.key, op, typename('T'));
        }

        const Expr = context.definitions[op];
        if (Expr) return Expr.parse(expr.slice(1), context);

        throw new ParsingError(`${key}[0]`, `Unknown expression "${op}". If you wanted a literal array, use ["literal", [...]].`);
    } else if (typeof expr === 'undefined') {
        throw new ParsingError(key, `'undefined' value invalid. Use null instead.`);
    } else if (typeof expr === 'object') {
        throw new ParsingError(key, `Bare objects invalid. Use ["literal", {...}] instead.`);
    } else {
        throw new ParsingError(key, `Expected an array, but found ${typeof expr} instead.`);
    }
}

module.exports = {
    Scope,
    ParsingContext,
    ParsingError,
    parseExpression,
    Reference
};
