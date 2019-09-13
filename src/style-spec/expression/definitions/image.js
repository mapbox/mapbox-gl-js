// @flow

import { ImageType, StringType } from '../types';

import type { Expression } from '../expression';
import type EvaluationContext from '../evaluation_context';
import type ParsingContext from '../parsing_context';
import type { Type } from '../types';

export default class ImageExpression implements Expression {
    type: Type;
    input: string;

    constructor(input: Expression) {
        this.type = ImageType;
        this.input = input;
    }

    static parse(args: $ReadOnlyArray<mixed>, context: ParsingContext): ?Expression {
        if (args.length !== 2) {
            return context.error(`Expected two arguments.`);
        }

        const name = context.parse(args[1], 1, StringType);
        if (!name) return null;

        return new ImageExpression(name);
    }

    evaluate(ctx: EvaluationContext) {
        const evaluatedImageName = this.input.evaluate(ctx);
        if (ctx.availableImages.indexOf(evaluatedImageName) > -1) {
            return evaluatedImageName;
        }

        return null;
    }

    eachChild(fn: (Expression) => void) {
        fn(this.input);
    }

    possibleOutputs() {
        // Technically the combinatoric set of all children
        // Usually, this.text will be undefined anyway
        return [undefined];
    }

    serialize() {
        return ["image", this.input];
    }
}
