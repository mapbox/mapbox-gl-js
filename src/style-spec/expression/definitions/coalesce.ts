import assert from 'assert';
import {checkSubtype, ValueType} from '../types';
import ResolvedImage from '../types/resolved_image';

import type {Expression, SerializedExpression} from '../expression';
import type ParsingContext from '../parsing_context';
import type EvaluationContext from '../evaluation_context';
import type {Type} from '../types';

class Coalesce implements Expression {
    type: Type;
    args: Array<Expression>;

    constructor(type: Type, args: Array<Expression>) {
        this.type = type;
        this.args = args;
    }

    static parse(args: ReadonlyArray<unknown>, context: ParsingContext): Coalesce | null | undefined {
        if (args.length < 2) {
            // @ts-expect-error - TS2322 - Type 'void' is not assignable to type 'Coalesce'.
            return context.error("Expectected at least one argument.");
        }
        let outputType: Type = (null as any);
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
            new Coalesce((outputType as any), parsedArgs);
    }

    evaluate(ctx: EvaluationContext): any {
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

    serialize(): SerializedExpression {
        const serialized = ["coalesce"];
        // @ts-expect-error - TS2345 - Argument of type 'SerializedExpression' is not assignable to parameter of type 'string'.
        this.eachChild(child => { serialized.push(child.serialize()); });
        return serialized;
    }
}

export default Coalesce;
