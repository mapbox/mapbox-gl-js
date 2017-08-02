// @flow

const { parseExpression, ParsingContext, match } = require('./expression');
const assert = require('assert');

import type { Expression }  from './expression';
import type { Type } from './types';

type Varargs = {| type: Type |};
type Signature = Array<Type> | Varargs;
type Compile = (args: Array<string>) => string;
type Definition = [Type, Signature, Compile] |
    {|type: Type, overloads: Array<[Signature, Compile]>|};

class CompoundExpression implements Expression {
    key: string;
    name: string;
    type: Type;
    compileFromArgs: Compile;
    args: Array<Expression>;

    static definitions: { [string]: Definition };

    constructor(key: string, name: string, type: Type, compileFromArgs: Compile, args: Array<Expression>) {
        this.key = key;
        this.name = name;
        this.type = type;
        this.compileFromArgs = compileFromArgs;
        this.args = args;
    }

    compile(): string {
        const compiledArgs: Array<string> = [];

        const args = this.args;
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            const compiledArg = arg.compile();
            compiledArgs.push(`(${compiledArg})`);
        }

        return this.compileFromArgs(compiledArgs);
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

    static parse(args: Array<mixed>, context: ParsingContext): ?Expression {
        const op: string = (args[0]: any);
        const definition = CompoundExpression.definitions[op];
        if (!definition) {
            return context.error(`Unknown expression "${op}". If you wanted a literal array, use ["literal", [...]].`, 0);
        }

        // First parse all the args
        const parsedArgs: Array<Expression> = [];
        for (const arg of args.slice(1)) {
            const parsed = parseExpression(arg, context.concat(1 + parsedArgs.length, op));
            if (!parsed) return null;
            parsedArgs.push(parsed);
        }

        // Now check argument types against each signature
        const type = Array.isArray(definition) ?
            definition[0] : definition.type;
        const overloads = Array.isArray(definition) ?
            [[definition[1], definition[2]]] :
            definition.overloads;

        let signatureContext: ParsingContext = (null: any);

        for (const [params, compileFromArgs] of overloads) {
            signatureContext = new ParsingContext(context.definitions, context.path, context.ancestors, context.scope);
            if (Array.isArray(params)) {
                if (params.length !== parsedArgs.length) {
                    signatureContext.error(`Expected ${params.length} arguments, but found ${parsedArgs.length} instead.`);
                    continue;
                }
            }

            for (let i = 0; i < parsedArgs.length; i++) {
                const expected = Array.isArray(params) ? params[i] : params.type;
                const arg = parsedArgs[i];
                match(expected, arg.type, signatureContext.concat(i + 1, op));
            }

            if (signatureContext.errors.length === 0) {
                return new CompoundExpression(context.key, op, type, compileFromArgs, parsedArgs);
            }
        }

        assert(signatureContext.errors.length > 0);

        if (overloads.length === 1) {
            context.errors.push.apply(context.errors, signatureContext.errors);
        } else {
            const signatures = overloads
                .map(([params]) => stringifySignature(params))
                .join(' | ');
            const actualTypes = parsedArgs
                .map(arg => arg.type.name)
                .join(', ');
            context.error(`Expected arguments of type ${signatures}, but found (${actualTypes}) instead.`);
        }

        return null;
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

