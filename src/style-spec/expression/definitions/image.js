// @flow

import {ResolvedImageType, StringType} from '../types.js';
import ResolvedImage from '../types/resolved_image.js';

import type {Expression} from '../expression.js';
import type EvaluationContext from '../evaluation_context.js';
import type ParsingContext from '../parsing_context.js';
import type {Type} from '../types.js';

export default class ImageExpression implements Expression {
    type: Type;
    input: Expression;

    constructor(input: Expression) {
        this.type = ResolvedImageType;
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

        const value = ResolvedImage.fromString(evaluatedImageName);
        if (value && ctx.availableImages) value.available = ctx.availableImages.indexOf(evaluatedImageName) > -1;

        return value;
    }

    eachChild(fn: (_: Expression) => void) {
        fn(this.input);
    }

    outputDefined() {
        // The output of image is determined by the list of available images in the evaluation context
        return false;
    }

    serialize() {
        return ["image", this.input.serialize()];
    }
}
