// @flow

const { parseExpression, ParsingError } = require('./expression');
const { match } = require('./types');
const assert = require('assert');

import type {
    Expression,
    ParsingContext,
    Scope
}  from './expression';
import type { Type, TypeError } from './types';

type Varargs = {| type: Type |};
type Signature = Array<Type> | Varargs;
type Compile = (args: Array<string>) => string;
type Definition = [Type, Signature, Compile] |
    {|type: Type, overloads: Array<[Signature, Compile]>|};

class CompoundExpression implements Expression {
    key: string;
    name: string;
    type: Type;
    definition: Definition;
    args: Array<Expression>;

    static definitions: { [string]: Definition };

    // set after typechecking
    compileFromArgs: ?Compile

    constructor(key: string, name: string, definition: Definition, args: Array<Expression>) {
        this.key = key;
        this.name = name;
        this.definition = definition;
        this.type = Array.isArray(definition) ?
            definition[0] : definition.type;
        this.args = args;
    }

    typecheck(scope: Scope, errors: Array<TypeError>) {
        // Check if the expected type matches the expression's output type
        const overloads = Array.isArray(this.definition) ?
            [[this.definition[1], this.definition[2]]] :
            this.definition.overloads;

        let signatureErrors = [];
        const args = [];
        for (const arg of this.args) {
            const checked = arg.typecheck(scope, errors);
            if (!checked) return null;
            args.push(checked);
        }

        for (const [params, compileFromArgs] of overloads) {
            signatureErrors = [];
            if (Array.isArray(params)) {
                if (params.length !== args.length) {
                    signatureErrors.push({
                        key: this.key,
                        error: `Expected ${params.length} arguments, but found ${args.length} instead.`
                    });
                    continue;
                }
            }

            for (let i = 0; i < args.length; i++) {
                const expected = Array.isArray(params) ? params[i] : params.type;
                match(expected, args[i].type, args[i].key, signatureErrors);
            }

            if (signatureErrors.length === 0) {
                return new CompoundExpression(this.key, this.name,
                    [this.type, params, compileFromArgs], args);
            }
        }

        assert(signatureErrors.length > 0);

        if (overloads.length === 1) {
            errors.push.apply(errors, signatureErrors);
        } else {
            const signatures = overloads
                .map(([params]) => stringifySignature(params))
                .join(' | ');
            const actualTypes = args
                .map(arg => arg.type.name)
                .join(', ');
            errors.push({key: this.key, error: `Expected arguments of type ${signatures}, but found (${actualTypes}) instead.`});
        }

        return null;
    }

    compile(): string {
        assert(Array.isArray(this.definition), this.name);
        const compiledArgs: Array<string> = [];

        const args = this.args;
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            const compiledArg = arg.compile();
            compiledArgs.push(`(${compiledArg})`);
        }

        return (this.definition: any)[2](compiledArgs);
    }

    serialize() {
        const name = this.name;
        const args = this.args.map(e => e.serialize());
        return [ name ].concat(args);
    }

    accept(visitor: Visitor<Expression>) {
        visitor.visit(this);
        this.args.forEach(a => a.accept(visitor));
    }

    // default parse; overridden by some subclasses
    static parse(args: Array<mixed>, context: ParsingContext) {
        const op: string = (args[0]: any);
        const definition = CompoundExpression.definitions[op];
        if (!definition) {
            throw new ParsingError(`${context.key}[0]`, `Unknown expression "${op}". If you wanted a literal array, use ["literal", [...]].`);
        }

        const parsedArgs: Array<Expression> = [];
        for (const arg of args.slice(1)) {
            parsedArgs.push(parseExpression(arg, context.concat(1 + parsedArgs.length, op)));
        }

        return new CompoundExpression(context.key, op, definition, parsedArgs);
    }

    static register(
        expressions: { [string]: Class<Expression> },
        definitions: { [string]: Definition }
    ) {
        assert(!CompoundExpression.definitions);
        CompoundExpression.definitions = definitions;
        for (const name in definitions) {
            expressions[name] = CompoundExpression;
        }
    }
}

function varargs(type: Type): Varargs {
    return { type };
}

function stringifySignature(signature: Signature): string {
    if (Array.isArray(signature)) {
        return `(${signature.map(param => param.name).join(', ')})`;
    } else {
        return `(${signature.type.name}...)`;
    }
}

module.exports = {
    CompoundExpression,
    varargs
};

