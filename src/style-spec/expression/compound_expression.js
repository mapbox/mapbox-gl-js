// @flow

import {toString} from './types.js';

import ParsingContext from './parsing_context.js';
import EvaluationContext from './evaluation_context.js';
import assert from 'assert';

import type {Expression, ExpressionRegistry} from './expression.js';
import type {Type} from './types.js';
import type {Value} from './values.js';

export type Varargs = {| type: Type |};
type Signature = Array<Type> | Varargs;
type Evaluate = (EvaluationContext, Array<Expression>) => Value;
type Definition = [Type, Signature, Evaluate] |
    {|type: Type, overloads: Array<[Signature, Evaluate]>|};

class CompoundExpression implements Expression {
    name: string;
    type: Type;
    _evaluate: Evaluate;
    args: Array<Expression>;
    _overloadIndex: number;

    static definitions: {[_: string]: Definition };

    constructor(name: string, type: Type, evaluate: Evaluate, args: Array<Expression>, overloadIndex: number) {
        this.name = name;
        this.type = type;
        this._evaluate = evaluate;
        this.args = args;
        this._overloadIndex = overloadIndex;
    }

    evaluate(ctx: EvaluationContext): Value {
        if (!this._evaluate) { // restore evaluate function after transfer between threads
            const definition = CompoundExpression.definitions[this.name];
            this._evaluate = Array.isArray(definition) ? definition[2] : definition.overloads[this._overloadIndex][1];
        }
        return this._evaluate(ctx, this.args);
    }

    eachChild(fn: (_: Expression) => void) {
        this.args.forEach(fn);
    }

    outputDefined(): boolean {
        return false;
    }

    serialize(): Array<mixed> {
        return [this.name].concat(this.args.map(arg => arg.serialize()));
    }

    static parse(args: $ReadOnlyArray<mixed>, context: ParsingContext): ?Expression {
        const op: string = (args[0]: any);
        const definition = CompoundExpression.definitions[op];
        if (!definition) {
            return context.error(`Unknown expression "${op}". If you wanted a literal array, use ["literal", [...]].`, 0);
        }

        // Now check argument types against each signature
        const type = Array.isArray(definition) ?
            definition[0] : definition.type;

        const availableOverloads = Array.isArray(definition) ?
            [[definition[1], definition[2]]] :
            definition.overloads;

        const overloadParams = [];

        let signatureContext: ParsingContext = (null: any);

        let overloadIndex = -1;

        for (const [params, evaluate] of availableOverloads) {
            if (Array.isArray(params) && params.length !== args.length - 1) continue; // param count doesn't match

            overloadParams.push(params);
            overloadIndex++;

            // Use a fresh context for each attempted signature so that, if
            // we eventually succeed, we haven't polluted `context.errors`.
            signatureContext = new ParsingContext(context.registry, context.path, null, context.scope, undefined, context._scope, context.options);

            // First parse all the args, potentially coercing to the
            // types expected by this overload.
            const parsedArgs: Array<Expression> = [];
            let argParseFailed = false;
            for (let i = 1; i < args.length; i++) {
                const arg = args[i];
                const expectedType = Array.isArray(params) ?
                    params[i - 1] :
                    params.type;

                const parsed = signatureContext.parse(arg, 1 + parsedArgs.length, expectedType);
                if (!parsed) {
                    argParseFailed = true;
                    break;
                }
                parsedArgs.push(parsed);
            }
            if (argParseFailed) {
                // Couldn't coerce args of this overload to expected type, move
                // on to next one.
                continue;
            }

            if (Array.isArray(params)) {
                if (params.length !== parsedArgs.length) {
                    signatureContext.error(`Expected ${params.length} arguments, but found ${parsedArgs.length} instead.`);
                    continue;
                }
            }

            for (let i = 0; i < parsedArgs.length; i++) {
                const expected = Array.isArray(params) ? params[i] : params.type;
                const arg = parsedArgs[i];
                signatureContext.concat(i + 1).checkSubtype(expected, arg.type);
            }

            if (signatureContext.errors.length === 0) {
                return new CompoundExpression(op, type, evaluate, parsedArgs, overloadIndex);
            }
        }

        assert(!signatureContext || signatureContext.errors.length > 0);

        if (overloadParams.length === 1) {
            context.errors.push(...signatureContext.errors);
        } else {
            const expected = overloadParams.length ? overloadParams : availableOverloads.map(([params]) => params);
            const signatures = expected.map(stringifySignature).join(' | ');

            const actualTypes = [];
            // For error message, re-parse arguments without trying to
            // apply any coercions
            for (let i = 1; i < args.length; i++) {
                const parsed = context.parse(args[i], 1 + actualTypes.length);
                if (!parsed) return null;
                actualTypes.push(toString(parsed.type));
            }
            context.error(`Expected arguments of type ${signatures}, but found (${actualTypes.join(', ')}) instead.`);
        }

        return null;
    }

    static register(
        registry: ExpressionRegistry,
        definitions: {[_: string]: Definition }
    ) {
        assert(!CompoundExpression.definitions);
        CompoundExpression.definitions = definitions;
        for (const name in definitions) {
            // $FlowFixMe[method-unbinding]
            registry[name] = CompoundExpression;
        }
    }
}

function stringifySignature(signature: Signature): string {
    if (Array.isArray(signature)) {
        return `(${signature.map(toString).join(', ')})`;
    } else {
        return `(${toString(signature.type)}...)`;
    }
}

export default CompoundExpression;
