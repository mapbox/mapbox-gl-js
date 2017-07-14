// @flow

const { typename } = require('./types');

import type { Type } from './types';
import type { ExpressionName } from './expression_name';

export type NArgs = { kind: 'nargs', types: Array<Type>, N: number };
export type Signature = Array<Type | NArgs>;

export type CompileError = {|
    error: string,
    key: string
|}

export interface Expression {
    key: string;
    type: Type;

    compile(): string | Array<CompileError>;
    serialize(): any;
    visit(fn: (Expression) => void): void;
}

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
    definitions: {[string]: Class<LambdaExpression>};
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

class LambdaExpression implements Expression {
    key: string;
    type: Type;
    args: Array<Expression>;

    constructor(key: *, type: Type, args: Array<Expression>) {
        this.key = key;
        this.type = type;
        this.args = args;
    }

    applyType(type: Type, args: Array<Expression>): Expression {
        return new this.constructor(this.key, type, args);
    }

    compile(): string | Array<CompileError> {
        const errors: Array<CompileError> = [];
        const compiledArgs: Array<string> = [];

        const args = this.args;
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            const compiledArg = arg.compile();
            if (Array.isArray(compiledArg)) {
                errors.push.apply(errors, compiledArg);
            } else {
                compiledArgs.push(`(${compiledArg})`);
            }
        }

        if (errors.length > 0) {
            return errors;
        }

        return this.compileFromArgs(compiledArgs);
    }

    compileFromArgs(_: Array<string>): string | Array<CompileError> {
        throw new Error('Unimplemented');
    }

    serialize() {
        const name = this.constructor.opName();
        const args = this.args.map(e => e.serialize());
        return [ name ].concat(args);
    }

    visit(fn: (Expression) => void) {
        fn(this);
        this.args.forEach(a => a.visit(fn));
    }

    // implemented by subclasses
    static opName(): ExpressionName { throw new Error('Unimplemented'); }
    static type(): Type { throw new Error('Unimplemented'); }
    static signatures(): Array<Signature> { throw new Error('Unimplemented'); }

    // default parse; overridden by some subclasses
    static parse(args: Array<mixed>, context: ParsingContext): LambdaExpression {
        const op = this.opName();
        const parsedArgs: Array<Expression> = [];
        for (const arg of args) {
            parsedArgs.push(parseExpression(arg, context.concat(1 + parsedArgs.length, op)));
        }

        return new this(context.key, this.type(), parsedArgs);
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

function nargs(N: number, ...types: Array<Type>) : NArgs {
    return {
        kind: 'nargs',
        types,
        N
    };
}

module.exports = {
    Scope,
    ParsingContext,
    ParsingError,
    parseExpression,
    LambdaExpression,
    Reference,
    nargs
};
