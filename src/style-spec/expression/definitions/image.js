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
        if (args.length !== 2) {
            return context.error(`Expected two arguments.`);
        }

        const imageName = args[1];

        console.log('parse', args, context);
        console.log('new ImageExpression(imageName)', new ImageExpression(imageName));
        return new ImageExpression(imageName);
    }

    evaluate(ctx: EvaluationContext) {
        console.log('evaluate', ctx);
    }

    eachChild(fn: (Expression) => void) {
        console.log('each child', fn);
        fn(this.name);
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
