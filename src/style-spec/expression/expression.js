// @flow

import type {Type} from './types';
import type ParsingContext from './parsing_context';
import type EvaluationContext from './evaluation_context';

export interface Expression {
    +type: Type;

    static parse(args: Array<mixed>, context: ParsingContext): ?Expression;
    evaluate(ctx: EvaluationContext): any;

    eachChild(fn: Expression => void): void;
}
