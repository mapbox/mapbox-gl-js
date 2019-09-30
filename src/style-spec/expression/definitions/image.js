// @flow

import {ImageType, StringType} from '../types';

import type {Expression} from '../expression';
import type EvaluationContext from '../evaluation_context';
import type ParsingContext from '../parsing_context';
import type {Type} from '../types';

export default class ImageExpression implements Expression {
    type: Type;
    input: Expression;

    constructor(input: Expression) {
        this.type = ImageType;
        this.input = input;
    }

    static parse(args: $ReadOnlyArray<mixed>, context: ParsingContext): ?Expression {
        if (args.length !== 2) {
            return context.error(`Expected two arguments.`);
        }

        const name = context.parse(args[1], 1, StringType);
        if (!name) return context.error(`No image name provided.`);

        return new ImageExpression(name);
    }

    evaluate(ctx: EvaluationContext) {
        const evaluatedImageName = this.input.evaluate(ctx);
        let available = false;

        if (ctx.availableImages && ctx.availableImages.indexOf(evaluatedImageName) > -1) {
            available = true;
        }

        return {name: evaluatedImageName, available};
    }

    eachChild(fn: (Expression) => void) {
        fn(this.input);
    }

    possibleOutputs() {
        // The output of image is determined by the list of available images in the evaluation context
        return [undefined];
    }

    serialize() {
        return ["image", this.input.serialize()];
    }
}
