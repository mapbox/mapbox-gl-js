// @flow

import type {
    Type,
} from './types';

export interface Expression {
    key: string;
    +type: Type;

    static parse(args: Array<mixed>, context: ParsingContext): ?Expression; // eslint-disable-line no-use-before-define

    compile(): string;

    serialize(): any;
    accept(Visitor<Expression>): void;
}

class ParsingError extends Error {
    key: string;
    message: string;
    constructor(key: string, message: string) {
        super(message);
        this.message = message;
        this.key = key;
    }
}

/**
 * Tracks `let` bindings during expression parsing.
 * @private
 */
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

/**
 * State associated parsing at a given point in an expression tree.
 * @private
 */
class ParsingContext {
    definitions: {[string]: Class<Expression>};
    path: Array<number>;
    key: string;
    scope: Scope;
    errors: Array<ParsingError>;

    // The expected type of this expression. Provided only to allow Expression
    // implementations to infer argument types: Expression#parse() need not
    // check that the output type of the parsed expression matches
    // `expectedType`.
    expectedType: ?Type;

    constructor(
        definitions: *,
        path: Array<number> = [],
        expectedType: ?Type,
        scope: Scope = new Scope(),
        errors: Array<ParsingError> = []
    ) {
        this.definitions = definitions;
        this.path = path;
        this.key = path.map(part => `[${part}]`).join('');
        this.scope = scope;
        this.errors = errors;
        this.expectedType = expectedType;
    }

    /**
     * Returns a copy of this context suitable for parsing the subexpression at
     * index `index`, optionally appending to 'let' binding map.
     *
     * Note that `errors` property, intended for collecting errors while
     * parsing, is copied by reference rather than cloned.
     * @private
     */
    concat(index: number, expectedType?: ?Type, bindings?: Array<[string, Expression]>) {
        const path = typeof index === 'number' ? this.path.concat(index) : this.path;
        const scope = bindings ? this.scope.concat(bindings) : this.scope;
        return new ParsingContext(
            this.definitions,
            path,
            expectedType || null,
            scope,
            this.errors
        );
    }

    /**
     * Push a parsing (or type checking) error into the `this.errors`
     * @param error The message
     * @param keys Optionally specify the source of the error at a child
     * of the current expression at `this.key`.
     * @private
     */
    error(error: string, ...keys: Array<number>) {
        const key = `${this.key}${keys.map(k => `[${k}]`).join('')}`;
        this.errors.push(new ParsingError(key, error));
        return null;
    }
}

module.exports = {
    Scope,
    ParsingContext,
    ParsingError
};
