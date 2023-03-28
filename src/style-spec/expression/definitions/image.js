// @flow

import {ResolvedImageType, StringType} from '../types.js';
import ResolvedImage from '../types/resolved_image.js';

import type {Expression, SerializedExpression} from '../expression.js';
import type EvaluationContext from '../evaluation_context.js';
import type ParsingContext from '../parsing_context.js';
import type {Type} from '../types.js';

export default class ImageExpression implements Expression {
    type: Type;
    inputPrimary: Expression;
    inputSecondary: ?Expression;

    constructor(inputPrimary: Expression, inputSecondary: ?Expression) {
        this.type = ResolvedImageType;
        this.inputPrimary = inputPrimary;
        this.inputSecondary = inputSecondary;
    }

    static parse(args: $ReadOnlyArray<mixed>, context: ParsingContext): ?Expression {
        if (args.length < 2) {
            return context.error(`Expected two or more arguments.`);
        }

        const namePrimary = context.parse(args[1], 1, StringType);
        if (!namePrimary) return context.error(`No image name provided.`);

        if (args.length === 2) {
            return new ImageExpression(namePrimary);
        }

        const nameSecondary = context.parse(args[2], 1, StringType);
        if (!nameSecondary) return context.error(`Secondary image variant is not a string.`);

        return new ImageExpression(namePrimary, nameSecondary);
    }

    evaluate(ctx: EvaluationContext): null | ResolvedImage {
        const value = ResolvedImage.fromString(this.inputPrimary.evaluate(ctx), this.inputSecondary ? this.inputSecondary.evaluate(ctx) : undefined);
        if (value && ctx.availableImages) {
            value.available = ctx.availableImages.indexOf(value.namePrimary) > -1;
            // If there's a secondary variant, only mark it available if both are present
            if (value.nameSecondary && value.available && ctx.availableImages) {
                value.available = ctx.availableImages.indexOf(value.nameSecondary) > -1;
            }
        }

        return value;
    }

    eachChild(fn: (_: Expression) => void) {
        fn(this.inputPrimary);
        if (this.inputSecondary) {
            fn(this.inputSecondary);
        }
    }

    outputDefined(): boolean {
        // The output of image is determined by the list of available images in the evaluation context
        return false;
    }

    serialize(): SerializedExpression {
        if (this.inputSecondary) {
            // $FlowIgnore
            return ["image", this.inputPrimary.serialize(), this.inputSecondary.serialize()];
        }
        return ["image", this.inputPrimary.serialize()];
    }
}
