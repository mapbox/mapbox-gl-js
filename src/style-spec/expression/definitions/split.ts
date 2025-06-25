import {
    StringType,
    array,
} from '../types';

import type {Expression, SerializedExpression} from '../expression';
import type ParsingContext from '../parsing_context';
import type EvaluationContext from '../evaluation_context';
import type {Type} from '../types';

class Split implements Expression {
    type: Type;
    str: Expression;
    delimiter: Expression;

    constructor(str: Expression, delimiter: Expression) {
        this.type = array(StringType);
        this.str = str;
        this.delimiter = delimiter;
    }

    static parse(args: ReadonlyArray<unknown>, context: ParsingContext): Split | void {
        if (args.length !== 3) {
            return context.error(`Expected 2 arguments, but found ${args.length - 1} instead.`);
        }

        const str = context.parse(args[1], 1, StringType);
        const delimiter = context.parse(args[2], 2, StringType);

        if (!str || !delimiter) return;

        return new Split(str, delimiter);
    }

    evaluate(ctx: EvaluationContext): string[] {
        const str = (this.str.evaluate(ctx) as string);
        const delimiter = (this.delimiter.evaluate(ctx) as string);

        return str.split(delimiter);
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
