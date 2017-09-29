// @flow

import type {Type} from './types';
import type ParsingContext from './parsing_context';
import type CompilationContext from './compilation_context';

export interface Expression {
    key: string;
    +type: Type;

    static parse(args: Array<mixed>, context: ParsingContext): ?Expression;

    compile(CompilationContext): string;

    serialize(): any;
    eachChild(fn: Expression => void): void;
}
