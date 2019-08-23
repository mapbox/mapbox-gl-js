// @flow

import { ValueType, ImageType, StringType } from '../types';
import Image from '../types/image';
import { toString } from '../values';

import type { Expression } from '../expression';
import type EvaluationContext from '../evaluation_context';
import type ParsingContext from '../parsing_context';
import type { Type } from '../types';

export default class ImageExpression implements Expression {
    type: Type;
    name: string;

    constructor(name: string) {
        this.type = ImageType;
        this.name = name;
    }

    static parse(args: $ReadOnlyArray<mixed>, context: ParsingContext): ?Expression {

    }

    evaluate(ctx: EvaluationContext) {

    }

    eachChild(fn: (Expression) => void) {

    }

    possibleOutputs() {
        // Technically the combinatoric set of all children
        // Usually, this.text will be undefined anyway
        return [undefined];
    }

    serialize() {
        return ["image", this.name];
    }
}
