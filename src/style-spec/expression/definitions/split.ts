import {
    StringType,
    ValueType,
    NullType,
    toString,
    isValidType,
    isValidNativeType,
    ObjectType,
} from '../types';
import RuntimeError from '../runtime_error';
import {typeOf} from '../values';

import type {Expression, SerializedExpression} from '../expression';
import type ParsingContext from '../parsing_context';
import type EvaluationContext from '../evaluation_context';
import type {Type} from '../types';

class Split implements Expression {
    type: Type;
    str: Expression;
    delimiter: Expression;

    constructor(str: Expression, delimiter: Expression) {
        this.type = ObjectType;
        this.str = str;
        this.delimiter = delimiter;
    }

    static parse(args: ReadonlyArray<unknown>, context: ParsingContext): Split | null | undefined {
        if (args.length !== 3) {
            // @ts-expect-error - TS2322 - Type 'void' is not assignable to type 'Split'.
            return context.error(`Expected 3 arguments, but found ${args.length - 1} instead.`);
        }

        const str = context.parse(args[1], 1, ValueType);
        const delimiter = context.parse(args[2], 2, ValueType);

        if (!str || !delimiter) return null;
        if (!isValidType(str.type, [StringType, NullType, ValueType])) {
            // @ts-expect-error - TS2322 - Type 'void' is not assignable to type 'Split'.
            return context.error(`Expected first argument to be of type string or null, but found ${toString(str.type)} instead`);
        }
        return new Split(str, delimiter);
    }

    evaluate(ctx: EvaluationContext): string[] {
        const str = (this.str.evaluate(ctx));
        const delimiter = (this.delimiter.evaluate(ctx));
        if (!isValidNativeType(str, ['string', 'null'])) {
            throw new RuntimeError(`Expected first argument to be of type boolean, string, number or null, but found ${toString(typeOf(str))} instead.`);
        }

        if (!str) {
            return [];
        }

        if (!isValidNativeType(delimiter, ['string'])) {
            throw new RuntimeError(`Expected second argument to be of type string, but found ${toString(typeOf(delimiter))} instead.`);
        }

        return (str as string).split(delimiter);
    }

    eachChild(fn: (_: Expression) => void) {
        fn(this.str);
        fn(this.delimiter);
    }

    outputDefined(): boolean {
        return false;
    }

    serialize(): SerializedExpression {
        return ["split", this.str.serialize(), this.delimiter.serialize()];
    }
}

export default Split;
