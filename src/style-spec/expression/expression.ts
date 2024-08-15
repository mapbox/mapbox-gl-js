import type {Type} from './types';
import type ParsingContext from './parsing_context';
import type EvaluationContext from './evaluation_context';

export type SerializedExpression = Array<unknown> | Array<string> | string | number | boolean | null;

export interface Expression {
    readonly type: Type;
    value?: any;
    evaluate: (ctx: EvaluationContext) => any;
    eachChild: (fn: (arg1: Expression) => void) => void;
    /**
      * Statically analyze the expression, attempting to enumerate possible outputs. Returns
      * false if the complete set of outputs is statically undecidable, otherwise true.
      */
    outputDefined: () => boolean;
    serialize: () => SerializedExpression;
}

export type ExpressionParser = (args: ReadonlyArray<unknown>, context: ParsingContext) => Expression | void;

export type ExpressionRegistration = {
    new(...args: any[]): Expression;
    readonly parse: ExpressionParser;
};

export type ExpressionRegistry = {
    [_: string]: ExpressionRegistration;
};
