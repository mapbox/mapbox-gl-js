// @flow

import assert from 'assert';

import {checkSubtype, ValueType} from '../types.js';
import ResolvedImage from '../types/resolved_image.js';

import type {Expression} from '../expression.js';
import type ParsingContext from '../parsing_context.js';
import type EvaluationContext from '../evaluation_context.js';
import type {Type} from '../types.js';

class Coalesce implements Expression {
    type: Type;
    args: Array<Expression>;

    constructor(type: Type, args: Array<Expression>) {
        this.type = type;
        this.args = args;
    }

    static parse(args: $ReadOnlyArray<mixed>, context: ParsingContext) {
        if (args.length < 2) {
            return context.error("Expectected at least one argument.");
        }
        let outputType: Type = (null: any);
        const expectedType = context.expectedType;
        if (expectedType && expectedType.kind !== 'value') {
            outputType = expectedType;
        }
        const parsedArgs = [];

        for (const arg of args.slice(1)) {
            const parsed = context.parse(arg, 1 + parsedArgs.length, outputType, undefined, {typeAnnotation: 'omit'});
            if (!parsed) return null;
            outputType = outputType || parsed.type;
            parsedArgs.push(parsed);
        }
        assert(outputType);

        // Above, we parse arguments without inferred type annotation so that
        // they don't produce a runtime error for `null` input, which would
        // preempt the desired null-coalescing behavior.
        // Thus, if any of our arguments would have needed an annotation, we
        // need to wrap the enclosing coalesce expression with it instead.
        const needsAnnotation = expectedType &&
            parsedArgs.some(arg => checkSubtype(expectedType, arg.type));

        return needsAnnotation ?
            new Coalesce(ValueType, parsedArgs) :
            new Coalesce((outputType: any), parsedArgs);
    }

    evaluate(ctx: EvaluationContext) {
        let result = null;
        let argCount = 0;
        let firstImage;
        for (const arg of this.args) {
            argCount++;
            result = arg.evaluate(ctx);
            // we need to keep track of the first requested image in a coalesce statement
            // if coalesce can't find a valid image, we return the first image so styleimagemissing can fire
            if (result && result instanceof ResolvedImage && !result.available) {
                // set to first image
                if (!firstImage) {
                    firstImage = result;
                }
                result = null;
                // if we reach the end, return the first image
                if (argCount === this.args.length) {
                    return firstImage;
                }
            }

            if (result !== null) break;
        }
        return result;
    }

    eachChild(fn: (_: Expression) => void) {
        this.args.forEach(fn);
    }

    outputDefined(): boolean {
        return this.args.every(arg => arg.outputDefined());
    }

    serialize() {
        const serialized = ["coalesce"];
        this.eachChild(child => { serialized.push(child.serialize()); });
        return serialized;
    }
}

export default Coalesce;
