// @flow

const Scope = require('./scope');
const {checkSubtype} = require('./types');
const ParsingError = require('./parsing_error');

import type {Expression} from './expression';
import type {Type} from './types';

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
    }

    /**
     * Returns null if `t` is a subtype of `expected`; otherwise returns an
     * error message and also pushes it to `this.errors`.
     */
    checkSubtype(expected: Type, t: Type): ?string {
        const error = checkSubtype(expected, t);
        if (error) this.error(error);
        return error;
    }
}

module.exports = ParsingContext;
