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
import type { Type, LambdaType } from './types';
import type { ExpressionName } from './expression_name';

export type Expression = LambdaExpression | LiteralExpression | LetExpression | Reference; // eslint-disable-line no-use-before-define

export type CompileError = {|
    error: string,
    key: string
|}

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

class BaseExpression {
    key: string;
    +type: Type;
    constructor(key: *, type: *) {
        this.key = key;
        (this: any).type = type;
    }

    getResultType() {
        return this.type.kind === 'lambda' ? this.type.result : this.type;
    }

    compile(): string | Array<CompileError> {
        throw new Error('Unimplemented');
    }

    serialize(_: boolean): any {
        throw new Error('Unimplemented');
    }

    visit(fn: (BaseExpression) => void): void { fn(this); }
}

class LiteralExpression extends BaseExpression {
    value: Value;

    constructor(key: *, type: Type, value: Value) {
        super(key, type);
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

    serialize(_: boolean) {
        if (this.value === null || typeof this.value === 'string' || typeof this.value === 'boolean' || typeof this.value === 'number') {
            return this.value;
        } else if (this.value instanceof Color) {
            return ["rgba"].concat(this.value.value);
        } else {
            return ["literal", this.value];
        }
    }
}

class LambdaExpression extends BaseExpression {
    args: Array<Expression>;
    type: LambdaType;
    constructor(key: *, type: LambdaType, args: Array<Expression>) {
        super(key, type);
        this.args = args;
    }

    applyType(type: LambdaType, args: Array<Expression>): Expression {
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

    serialize(withTypes: boolean) {
        const name = this.constructor.getName();
        const type = this.type.kind === 'lambda' ? this.type.result.name : this.type.name;
        const args = this.args.map(e => e.serialize(withTypes));
        return [ name + (withTypes ? `: ${type}` : '') ].concat(args);
    }

    visit(fn: (BaseExpression) => void) {
        fn(this);
        this.args.forEach(a => a.visit(fn));
    }

    // implemented by subclasses
    static getName(): ExpressionName { throw new Error('Unimplemented'); }
    static getType(): LambdaType { throw new Error('Unimplemented'); }

    // default parse; overridden by some subclasses
    static parse(args: Array<mixed>, context: ParsingContext): LambdaExpression {
        const op = this.getName();
        const parsedArgs: Array<Expression> = [];
        for (const arg of args) {
            parsedArgs.push(parseExpression(arg, context.concat(1 + parsedArgs.length, op)));
        }

        return new this(context.key, this.getType(), parsedArgs);
    }
}

class Reference extends BaseExpression {
    name: string;
    constructor(key: string, name: string, type: Type) {
        super(key, type);
        if (!/^[a-zA-Z_]+[a-zA-Z_0-9]*$/.test(name))
            throw new ParsingError(key, `Invalid identifier ${name}.`);
        this.name = name;
    }

    compile() { return this.name; }

    serialize(_: boolean) {
        return [this.name];
    }
}

class LetExpression extends BaseExpression {
    bindings: Array<[string, Expression]>;
    result: Expression;
    constructor(key: string, bindings: Array<[string, Expression]>, result: Expression) {
        super(key, result.type);
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

    serialize(withTypes: boolean) {
        const serialized = ['let'];
        for (const [name, expression] of this.bindings) {
            serialized.push(name, expression.serialize(withTypes));
        }
        serialized.push(this.result.serialize(withTypes));
        return serialized;
    }

    visit(fn: (BaseExpression) => void): void {
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
        } else if (op === 'literal') {
            return LiteralExpression.parse(expr.slice(1), context);
        } else if (op === 'let') {
            return LetExpression.parse(expr.slice(1), context);
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

module.exports = {
    Scope,
    ParsingContext,
    ParsingError,
    parseExpression,
    LiteralExpression,
    LambdaExpression,
    LetExpression,
    Reference
};
