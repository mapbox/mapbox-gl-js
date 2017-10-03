// @flow

import type {Type} from './types';
import type {Value} from './values';
import type ParsingContext from './parsing_context';
import type CompilationContext from './compilation_context';
import type EvaluationContext from './evaluation_context';

export interface Expression {
    key: string;
    +type: Type;

    static parse(args: Array<mixed>, context: ParsingContext): ?Expression;
    compile(ctx: CompilationContext): (EvaluationContext) => Value;

    serialize(): any;
    eachChild(fn: Expression => void): void;
}
