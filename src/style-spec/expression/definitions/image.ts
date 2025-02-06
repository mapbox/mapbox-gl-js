import {ColorType, ResolvedImageType, StringType} from '../types';
import ResolvedImage from '../types/resolved_image';

import type Color from '../../util/color';
import type {Expression, SerializedExpression} from '../expression';
import type EvaluationContext from '../evaluation_context';
import type ParsingContext from '../parsing_context';
import type {Type} from '../types';

export type ImageParams = Record<string, Expression>;

export type ImageOptions = {
    params: ImageParams;
}

function isImageOptions(value: unknown) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        return true;
    }

    return false;
}

export default class ImageExpression implements Expression {
    type: Type;
    inputPrimary: Expression;
    inputPrimaryParams: Record<string, Expression> | undefined;
    inputSecondary: Expression | null | undefined;
    inputSecondaryParams: Record<string, Expression> | undefined;

    _imageWarnHistory: Record<string, boolean> = {};

    constructor(
        inputPrimary: Expression,
        inputSecondary?: Expression | null,
        inputPrimaryParams?: Record<string, Expression>,
        inputSecondaryParams?: Record<string, Expression>
    ) {
        this.type = ResolvedImageType;
        this.inputPrimary = inputPrimary;
        this.inputSecondary = inputSecondary;
        this.inputPrimaryParams = inputPrimaryParams;
        this.inputSecondaryParams = inputSecondaryParams;
    }

    static parse(args: ReadonlyArray<unknown>, context: ParsingContext): Expression | null | undefined {
        if (args.length < 2) {
            // @ts-expect-error - TS2322 - Type 'void' is not assignable to type 'Expression'.
            return context.error(`Expected two or more arguments.`);
        }

        let nextArgId = 1;
        const imageExpression: Array<{image: Expression, options: Record<string, Expression>}> = [];

        function tryParseImage() {
            if (nextArgId < args.length) {
                const imageName = context.parse(args[nextArgId], nextArgId++, StringType);
                if (!imageName) {
                    context.error(imageExpression.length ? `Secondary image variant is not a string.` : `No image name provided.`);
                    return false;
                }

                imageExpression.push({image: imageName, options: undefined});
                return true;
            }

            return true;
        }

        function tryParseOptions() {
            if (nextArgId < args.length) {
                if (!isImageOptions(args[nextArgId])) {
                    return true;
                }

                const params = (args[nextArgId] as ImageOptions).params;

                const optionsContext = context.concat(nextArgId);

                if (!params) {
                    nextArgId++;
                    return true;
                }

                if (typeof params !== 'object' || params.constructor !== Object) {
                    optionsContext.error(`Image options \"params\" should be an object`);
                    return false;
                }

                const parsed = {};

                const childContext = optionsContext.concat(undefined, 'params');

                for (const key in params) {
                    if (!key) {
                        childContext.error(`Image parameter name should be non-empty`);
                        return false;
                    }

                    const value = childContext.concat(undefined, key).parse(params[key], undefined, ColorType, undefined, {typeAnnotation: 'coerce'});
                    if (!value) {
                        return false;
                    }

                    parsed[key] = value;
                }

                imageExpression[imageExpression.length - 1].options = parsed;
                nextArgId++;

                return true;
            }

            return true;
        }

        // Parse the primary and secondary image expressions
        for (let i = 0; i < 2; i++) {
            if (!tryParseImage() || !tryParseOptions()) {
                return;
            }
        }

        return new ImageExpression(
            imageExpression[0].image,
            imageExpression[1] ? imageExpression[1].image : undefined,
            imageExpression[0].options,
            imageExpression[1] ? imageExpression[1].options : undefined
        );
    }

    evaluateParams(ctx: EvaluationContext, params: Record<string, Expression> | undefined): {params: Record<string, Color>} {
        const result: Record<string, Color> = {};
        if (params) {
            for (const key in params) {
                if (params[key]) {
                    try {
                        const color = params[key].evaluate(ctx);
                        const msg = `Ignoring image parameter "${key}" with semi-transparent color ${color.toString()}`;

                        if (color.a !== 1) {
                            if (!this._imageWarnHistory[msg]) {
                                console.warn(msg);
                                this._imageWarnHistory[msg] = true;
                            }
                            continue;
                        }
                        result[key] = color;
                    } catch (err) {
                        continue;
                    }
                }
            }
        } else {
            return undefined;
        }

        if (Object.keys(result).length === 0) {
            return undefined;
        }

        return {params: result};
    }

    evaluate(ctx: EvaluationContext): null | ResolvedImage {
        const value = ResolvedImage.build(
            this.inputPrimary.evaluate(ctx),
            this.inputSecondary ? this.inputSecondary.evaluate(ctx) : undefined,
            this.inputPrimaryParams ? this.evaluateParams(ctx, this.inputPrimaryParams) : undefined,
            this.inputSecondaryParams ? this.evaluateParams(ctx, this.inputSecondaryParams) : undefined
        );
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
        if (this.inputPrimaryParams) {
            for (const key in this.inputPrimaryParams) {
                if (this.inputPrimaryParams[key]) {
                    fn(this.inputPrimaryParams[key]);
                }
            }
        }
        if (this.inputSecondary) {
            fn(this.inputSecondary);
            if (this.inputSecondaryParams) {
                for (const key in this.inputSecondaryParams) {
                    if (this.inputSecondaryParams[key]) {
                        fn(this.inputSecondaryParams[key]);
                    }
                }
            }
        }
    }

    outputDefined(): boolean {
        // The output of image is determined by the list of available images in the evaluation context
        return false;
    }

    serializeParams(params: Record<string, Expression> | undefined): {params: Record<string, SerializedExpression>} {
        const result: Record<string, SerializedExpression> = {};
        if (params) {
            for (const key in params) {
                if (params[key]) {
                    result[key] = params[key].serialize();
                }
            }
        } else {
            return undefined;
        }

        return {params: result};
    }

    serialize(): SerializedExpression {
        const serialized: SerializedExpression = ["image", this.inputPrimary.serialize()];

        if (this.inputPrimaryParams) {
            serialized.push(this.serializeParams(this.inputPrimaryParams));
        }

        if (this.inputSecondary) {
            serialized.push(this.inputSecondary.serialize());

            if (this.inputSecondaryParams) {
                serialized.push(this.serializeParams(this.inputSecondaryParams));
            }
        }

        return serialized;
    }
}
