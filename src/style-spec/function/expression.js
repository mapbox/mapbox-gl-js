// @flow

import type {
    Type,
} from './types';
const {
    NumberType,
    StringType,
    BooleanType,
    ObjectType,
    ColorType,
    ValueType,
    array
} = require('./types');

/*::

export interface Expression {
    key: string;
    +type: Type;

    static parse(args: Array<mixed>, context: ParsingContext): ?Expression;

    compile(): string;

    serialize(): any;
    accept(Visitor<Expression>): void;
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
    errors: Array<ParsingError>;

    constructor(definitions: *, path: Array<number> = [], ancestors: * = [], scope: Scope = new Scope(), errors: Array<ParsingError> = []) {
        this.definitions = definitions;
        this.path = path;
        this.key = path.map(part => `[${part}]`).join('');
        this.ancestors = ancestors;
        this.scope = scope;
        this.errors = errors;
    }

    // Returns a copy of this context suitable for parsing the subexpression at
    // index `index`, optionally appending to 'let' binding map.
    //
    // Note that `errors` property, intended for collecting errors while
    // parsing, is copied by reference rather than cloned.
    concat(index: number, expressionName: string, bindings?: Array<[string, Expression]>) {
        const path = typeof index === 'number' ? this.path.concat(index) : this.path;
        const ancestors = expressionName ? this.ancestors.concat(expressionName) : this.ancestors;
        const scope = bindings ? this.scope.concat(bindings) : this.scope;
        return new ParsingContext(this.definitions, path, ancestors, scope, this.errors);
    }

    error(error: string, ...keys: Array<number>) {
        const key = `${this.key}${keys.map(k => `[${k}]`).join('')}`;
        this.errors.push(new ParsingError(key, error));
        return null;
    }
}

function parseExpression(expr: mixed, context: ParsingContext, expectedType?: Type) : ?Expression {
    if (expr === null || typeof expr === 'string' || typeof expr === 'boolean' || typeof expr === 'number') {
        expr = ['literal', expr];
    }

    if (Array.isArray(expr)) {
        if (expr.length === 0) {
            return context.error(`Expected an array with at least one element. If you wanted a literal array, use ["literal", []].`);
        }

        const op = expr[0];
        if (typeof op !== 'string') {
            context.error(`Expression name must be a string, but found ${typeof op} instead. If you wanted a literal array, use ["literal", [...]].`, 0);
            return null;
        }

        const Expr = context.definitions[op];
        if (Expr) {
            const parsed = Expr.parse(expr, context);
            if (!parsed) return null;
            if (expectedType && match(expectedType, parsed.type, context)) {
                return null;
            } else {
                return parsed;
            }
        }

        return context.error(`Unknown expression "${op}". If you wanted a literal array, use ["literal", [...]].`, 0);
    } else if (typeof expr === 'undefined') {
        return context.error(`'undefined' value invalid. Use null instead.`);
    } else if (typeof expr === 'object') {
        return context.error(`Bare objects invalid. Use ["literal", {...}] instead.`);
    } else {
        return context.error(`Expected an array, but found ${typeof expr} instead.`);
    }
}

/**
 * Returns null if the type matches, or an error message if not.
 *
 * Also populate the given typenames context when a generic type is successfully
 * matched against a concrete one, with `scope` controlling whether type names
 * from `expected` or `t` are to be bound.
 *
 * @private
 */
function match(
    expected: Type,
    t: Type,
    context?: ParsingContext
): ?string {
    let error = `Expected ${expected.name} but found ${t.name} instead.`;

    // a `null` literal is allowed anywhere.
    if (t.name === 'Null') return null;

    if (expected.name === 'Value') {
        if (t === expected) return null;
        const members = [
            NumberType,
            StringType,
            BooleanType,
            ColorType,
            ObjectType,
            array(ValueType)
        ];

        for (const memberType of members) {
            if (!match(memberType, t)) {
                return null;
            }
        }

        if (context) context.error(error);
        return error;
    } if (expected.kind === 'primitive') {
        if (t === expected) return null;
        if (context) context.error(error);
        return error;
    } else if (expected.kind === 'array') {
        if (t.kind === 'array') {
            const itemError = match(expected.itemType, t.itemType);
            if (itemError) {
                error = `${error} (${itemError})`;
                if (context) context.error(error);
                return error;
            } else if (typeof expected.N === 'number' && expected.N !== t.N) {
                if (context) context.error(error);
                return error;
            } else {
                return null;
            }
        } else {
            if (context) context.error(error);
            return error;
        }
    }

    throw new Error(`${expected.name} is not a valid output type.`);
}

module.exports = {
    Scope,
    ParsingContext,
    ParsingError,
    parseExpression,
    match
};
