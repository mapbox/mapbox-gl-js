import ResolvedImage from '../types/resolved_image';
import {ImageId} from '../types/image_id';
import {ColorType, ResolvedImageType, StringType} from '../types';

import type Color from '../../util/color';
import type ParsingContext from '../parsing_context';
import type EvaluationContext from '../evaluation_context';
import type {Type} from '../types';
import type {Expression, SerializedExpression} from '../expression';

export type ImageParams = Record<string, Expression>;
export type IconsetParams = {id: string};

export type ImageOptions = {
    params?: ImageParams;
    iconset?: IconsetParams;
}

type SerializedImageOptions = {
    params?: Record<string, SerializedExpression>;
    iconset?: IconsetParams;
};

function isImageOptions(value: unknown): value is ImageOptions {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export default class ImageExpression implements Expression {
    type: Type;

    namePrimary: Expression;
    paramsPrimary?: ImageParams;
    iconsetIdPrimary?: string;

    nameSecondary?: Expression;
    paramsSecondary?: ImageParams;
    iconsetIdSecondary?: string;

    _imageWarnHistory: Record<string, boolean> = {};

    constructor(
        inputPrimary: Expression,
        inputSecondary?: Expression | null,
        inputPrimaryOptions?: ImageOptions,
        inputSecondaryOptions?: ImageOptions
    ) {
        this.type = ResolvedImageType;
        this.namePrimary = inputPrimary;
        this.nameSecondary = inputSecondary;

        if (inputPrimaryOptions) {
            this.paramsPrimary = inputPrimaryOptions.params;
            this.iconsetIdPrimary = inputPrimaryOptions.iconset ? inputPrimaryOptions.iconset.id : undefined;
        }

        if (inputSecondaryOptions) {
            this.paramsSecondary = inputSecondaryOptions.params;
            this.iconsetIdSecondary = inputSecondaryOptions.iconset ? inputSecondaryOptions.iconset.id : undefined;
        }
    }

    static parse(args: ReadonlyArray<unknown>, context: ParsingContext): Expression | null | void {
        if (args.length < 2) {
            return context.error(`Expected two or more arguments.`);
        }

        let nextArgId = 1;
        const imageExpression: Array<{image: Expression, options?: ImageOptions}> = [];

        function tryParseImage() {
            if (nextArgId < args.length) {
                const imageName = context.parse(args[nextArgId], nextArgId++, StringType);
                if (!imageName) {
                    context.error(imageExpression.length ? `Secondary image variant is not a string.` : `No image name provided.`);
                    return false;
                }

                imageExpression.push({image: imageName, options: {}});
                return true;
            }

            return true;
        }

        function tryParseOptions() {
            if (nextArgId < args.length) {
                const options = args[nextArgId];
                if (!isImageOptions(options)) {
                    return true;
                }

                const params = options.params;
                const iconset = options.iconset;
                const optionsContext = context.concat(nextArgId);

                if (!params && !iconset) {
                    nextArgId++;
                    return true;
                }

                // Parse the image options params as expressions
                if (params) {
                    if (typeof params !== 'object' || params.constructor !== Object) {
                        optionsContext.error(`Image options \"params\" should be an object`);
                        return false;
                    }

                    const parsedParams: ImageParams = {};
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

                        parsedParams[key] = value;
                    }

                    imageExpression[imageExpression.length - 1].options.params = parsedParams;
                }

                // Validate the iconset image options
                if (iconset) {
                    if (typeof iconset !== 'object' || iconset.constructor !== Object) {
                        optionsContext.error(`Image options \"iconset\" should be an object`);
                        return false;
                    }

                    if (!iconset.id) {
                        optionsContext.error(`Image options \"iconset\" should have an \"id\" property`);
                        return false;
                    }

                    imageExpression[imageExpression.length - 1].options.iconset = iconset;
                }

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
                        result[key] = params[key].evaluate(ctx);
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
        const primaryId = {
            name: this.namePrimary.evaluate(ctx),
            iconsetId: this.iconsetIdPrimary
        };

        const secondaryId = this.nameSecondary ? {
            name: this.nameSecondary.evaluate(ctx),
            iconsetId: this.iconsetIdSecondary
        } : undefined;

        const value = ResolvedImage.build(
            primaryId,
            secondaryId,
            this.paramsPrimary ? this.evaluateParams(ctx, this.paramsPrimary) : undefined,
            this.paramsSecondary ? this.evaluateParams(ctx, this.paramsSecondary) : undefined
        );

        if (value && ctx.availableImages) {
            const primaryId = value.getPrimary().id;
            value.available = ctx.availableImages.some((id) => ImageId.isEqual(id, primaryId));
            if (value.available) {
                // If there's a secondary variant, only mark it available if both are present
                const secondaryId = value.getSecondary() ? value.getSecondary().id : null;
                if (secondaryId) value.available = ctx.availableImages.some((id) => ImageId.isEqual(id, secondaryId));
            }
        }

        return value;
    }

    eachChild(fn: (_: Expression) => void) {
        fn(this.namePrimary);

        if (this.paramsPrimary) {
            for (const key in this.paramsPrimary) {
                if (this.paramsPrimary[key]) {
                    fn(this.paramsPrimary[key]);
                }
            }
        }

        if (this.nameSecondary) {
            fn(this.nameSecondary);
            if (this.paramsSecondary) {
                for (const key in this.paramsSecondary) {
                    if (this.paramsSecondary[key]) {
                        fn(this.paramsSecondary[key]);
                    }
                }
            }
        }
    }

    outputDefined(): boolean {
        // The output of image is determined by the list of available images in the evaluation context
        return false;
    }

    serializeOptions(params: ImageParams, iconsetId: string): SerializedImageOptions | undefined {
        const result: SerializedImageOptions = {};

        if (iconsetId) {
            result.iconset = {id: iconsetId};
        }

        if (params) {
            result.params = {};
            for (const key in params) {
                if (params[key]) {
                    result.params[key] = params[key].serialize();
                }
            }
        }

        return Object.keys(result).length > 0 ? result : undefined;
    }

    serialize(): SerializedExpression {
        const serialized: SerializedExpression = ['image', this.namePrimary.serialize()];

        if (this.paramsPrimary || this.iconsetIdPrimary) {
            const options = this.serializeOptions(this.paramsPrimary, this.iconsetIdPrimary);
            if (options) serialized.push(options);
        }

        if (this.nameSecondary) {
            serialized.push(this.nameSecondary.serialize());

            if (this.paramsSecondary || this.iconsetIdSecondary) {
                const options = this.serializeOptions(this.paramsSecondary, this.iconsetIdSecondary);
                if (options) serialized.push(options);
            }
        }

        return serialized;
    }
}
