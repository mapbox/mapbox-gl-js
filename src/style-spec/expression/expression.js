// @flow

import type {Type} from './types';
import type {Value} from './values';
import type EvaluationContext from './evaluation_context';

export interface Expression {
    +type: Type;

    // Static interface properties are not supported in flow as of 0.62.0.
    // https://github.com/facebook/flow/issues/5590
    // static parse(args: Array<mixed>, context: ParsingContext): ?Expression;

    evaluate(ctx: EvaluationContext): any;

    eachChild(fn: Expression => void): void;

    /**
     * Statically analyze the expression, attempting to enumerate possible outputs. Returns
     * an array of values plus the sentinel value `undefined`, used to indicate that the
     * complete set of outputs is statically undecidable.
     */
    possibleOutputs(): Array<Value | void>;
}
