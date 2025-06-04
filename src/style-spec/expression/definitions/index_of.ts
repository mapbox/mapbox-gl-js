import {
    BooleanType,
    StringType,
    ValueType,
    NullType,
    toString,
    NumberType,
    isValidType,
    isValidNativeType,
} from '../types';
import RuntimeError from '../runtime_error';
import {typeOf} from '../values';

import type {Expression, SerializedExpression} from '../expression';
import type ParsingContext from '../parsing_context';
import type EvaluationContext from '../evaluation_context';
import type {Type} from '../types';

class IndexOf implements Expression {
    type: Type;
    needle: Expression;
    haystack: Expression;
    fromIndex: Expression | null | undefined;

    constructor(needle: Expression, haystack: Expression, fromIndex?: Expression) {
        this.type = NumberType;
        this.needle = needle;
        this.haystack = haystack;
        this.fromIndex = fromIndex;
    }

    static parse(args: ReadonlyArray<unknown>, context: ParsingContext): IndexOf | null | undefined {
        if (args.length <= 2 ||  args.length >= 5) {
            // @ts-expect-error - TS2322 - Type 'void' is not assignable to type 'IndexOf'.
            return context.error(`Expected 3 or 4 arguments, but found ${args.length - 1} instead.`);
        }

        const needle = context.parse(args[1], 1, ValueType);

        const haystack = context.parse(args[2], 2, ValueType);

        if (!needle || !haystack) return null;
        if (!isValidType(needle.type, [BooleanType, StringType, NumberType, NullType, ValueType])) {
            // @ts-expect-error - TS2322 - Type 'void' is not assignable to type 'IndexOf'.
            return context.error(`Expected first argument to be of type boolean, string, number or null, but found ${toString(needle.type)} instead`);
        }

        if (args.length === 4) {
            const fromIndex = context.parse(args[3], 3, NumberType);
            if (!fromIndex) return null;
            return new IndexOf(needle, haystack, fromIndex);
        } else {
            return new IndexOf(needle, haystack);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    evaluate(ctx: EvaluationContext): any {
        const needle = (this.needle.evaluate(ctx));
        const haystack = (this.haystack.evaluate(ctx));

        if (!isValidNativeType(needle, ['boolean', 'string', 'number', 'null'])) {
            throw new RuntimeError(`Expected first argument to be of type boolean, string, number or null, but found ${toString(typeOf(needle))} instead.`);
        }

        if (!isValidNativeType(haystack, ['string', 'array'])) {
            throw new RuntimeError(`Expected second argument to be of type array or string, but found ${toString(typeOf(haystack))} instead.`);
        }

        if (this.fromIndex) {
            const fromIndex = (this.fromIndex.evaluate(ctx) as number);
            return haystack.indexOf(needle, fromIndex);
        }

        return haystack.indexOf(needle);
    }

    eachChild(fn: (_: Expression) => void) {
        fn(this.needle);
        fn(this.haystack);
        if (this.fromIndex) {
            fn(this.fromIndex);
        }
    }

    outputDefined(): boolean {
        return false;
    }

    serialize(): SerializedExpression {
        if (this.fromIndex != null && this.fromIndex !== undefined) {
            const fromIndex = this.fromIndex.serialize();
            return ["index-of", this.needle.serialize(), this.haystack.serialize(), fromIndex];
        }
        return ["index-of", this.needle.serialize(), this.haystack.serialize()];
    }
}

export default IndexOf;
