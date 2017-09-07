// @flow

const { toString } = require('./types');
const { ParsingContext } = require('./expression');
const parseExpression = require('./parse_expression');
const checkSubtype = require('./check_subtype');
const assert = require('assert');

import type { Expression, CompilationContext }  from './expression';
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

    compile(ctx: CompilationContext) {
        const compiledArgs: Array<string> = [];

        const args = this.args;
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            const compiledArg = ctx.compile(arg);
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

        // Now check argument types against each signature
        const type = Array.isArray(definition) ?
            definition[0] : definition.type;

        const overloads = Array.isArray(definition) ?
            [[definition[1], definition[2]]] :
            definition.overloads.filter(overload => (
                !Array.isArray(overload[0][0]) || // varags
                overload[0][0].length === args.length - 1 // correct param count
            ));

        // First parse all the args
        const parsedArgs: Array<Expression> = [];
        for (let i = 1; i < args.length; i++) {
            const arg = args[i];
            let expected;
            if (overloads.length === 1) {
                const params = overloads[0][0];
                expected = Array.isArray(params) ?
                    params[i - 1] :
                    params.type;
            }
            const parsed = parseExpression(arg, context.concat(1 + parsedArgs.length, expected));
            if (!parsed) return null;
            parsedArgs.push(parsed);
        }

        let signatureContext: ParsingContext = (null: any);

        for (const [params, compileFromArgs] of overloads) {
            // Use a fresh context for each attempted signature so that, if
            // we eventually succeed, we haven't polluted `context.errors`.
            signatureContext = new ParsingContext(context.definitions, context.path, null, context.scope);

            if (Array.isArray(params)) {
                if (params.length !== parsedArgs.length) {
                    signatureContext.error(`Expected ${params.length} arguments, but found ${parsedArgs.length} instead.`);
                    continue;
                }
            }

            for (let i = 0; i < parsedArgs.length; i++) {
                const expected = Array.isArray(params) ? params[i] : params.type;
                const arg = parsedArgs[i];
                checkSubtype(expected, arg.type, signatureContext.concat(i + 1));
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
                .map(arg => toString(arg.type))
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
        return `(${signature.map(toString).join(', ')})`;
    } else {
        return `(${toString(signature.type)}...)`;
    }
}

module.exports = {
    CompoundExpression,
    varargs
};

