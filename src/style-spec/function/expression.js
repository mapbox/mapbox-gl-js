// @flow

const {
    NullType,
    StringType,
    NumberType,
    BooleanType,
    typename
} = require('./types');

const {Color, isValue, typeOf} = require('./values');

import type { Value }  from './values';
import type { Type, } from './types';
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

class LiteralExpression implements Expression {
    key: string;
    type: Type;
    value: Value;

    constructor(key: *, type: Type, value: Value) {
        this.key = key;
        this.type = type;
        this.value = value;
    }

    static parse(args: Array<mixed>, context: ParsingContext) {
        if (args.length !== 1)
            throw new ParsingError(context.key, `'literal' expression requires exactly one argument, but found ${args.length} instead.`);

        if (!isValue(args[0]))
            throw new ParsingError(context.key, `invalid value`);

        const value = (args[0] : any);
        const type = typeOf(value);

        return new this(context.key, type, value);
    }

    compile() {
        const value = JSON.stringify(this.value);
        return typeof this.value === 'object' ?  `(${value})` : value;
    }

    serialize() {
        if (this.value === null || typeof this.value === 'string' || typeof this.value === 'boolean' || typeof this.value === 'number') {
            return this.value;
        } else if (this.value instanceof Color) {
            return ["rgba"].concat(this.value.value);
        } else {
            return ["literal", this.value];
        }
    }

    visit(fn: (Expression) => void) { fn(this); }
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
        if (Array.isArray(result)) {
            errors.push.apply(errors, result);
            return errors;
        }

        if (errors.length > 0) return errors;

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

function parseExpression(expr: mixed, context: ParsingContext) : Expression {
    const key = context.key;

    if (expr === null) {
        return new LiteralExpression(key, NullType, expr);
    } else if (typeof expr === 'undefined') {
        throw new ParsingError(key, `'undefined' value invalid. Use null instead.`);
    } else if (typeof expr === 'string') {
        return new LiteralExpression(key, StringType, expr);
    } else if (typeof expr === 'boolean') {
        return new LiteralExpression(key, BooleanType, expr);
    } else if (typeof expr === 'number') {
        return new LiteralExpression(key, NumberType, expr);
    } else if (Array.isArray(expr)) {
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
    LiteralExpression,
    LambdaExpression,
    LetExpression,
    Reference,
    nargs
};
