import {
    NumberType,
    ValueType,
    FormattedType,
    array,
    StringType,
    ColorType,
    ResolvedImageType,
    typeEquals,
} from '../types';
import Formatted, {FormattedSection} from '../types/formatted';
import {toString, typeOf} from '../values';

import type {Expression, SerializedExpression} from '../expression';
import type EvaluationContext from '../evaluation_context';
import type ParsingContext from '../parsing_context';
import type {Type} from '../types';

export type FormattedSectionExpression = {
    // Content of a section may be Image expression or other
    // type of expression that is coercable to 'string'.
    content: Expression;
    scale: Expression | null;
    font: Expression | null;
    textColor: Expression | null;
};

export default class FormatExpression implements Expression {
    type: Type;
    sections: Array<FormattedSectionExpression>;

    constructor(sections: Array<FormattedSectionExpression>) {
        this.type = FormattedType;
        this.sections = sections;
    }

    static parse(args: ReadonlyArray<unknown>, context: ParsingContext): Expression | null | void {
        if (args.length < 2) {
            return context.error(`Expected at least one argument.`);
        }

        const firstArg = args[1];
        if (!Array.isArray(firstArg) && typeof firstArg === 'object') {
            return context.error(`First argument must be an image or text section.`);
        }

        const sections: Array<FormattedSectionExpression> = [];
        let nextTokenMayBeObject = false;
        for (let i = 1; i <= args.length - 1; ++i) {
            const arg = args[i];

            if (nextTokenMayBeObject && typeof arg === "object" && !Array.isArray(arg)) {
                nextTokenMayBeObject = false;

                let scale = null;
                if (arg['font-scale']) {
                    scale = context.parseObjectValue(arg['font-scale'], i, 'font-scale', NumberType);
                    if (!scale) return null;
                }

                let font = null;
                if (arg['text-font']) {
                    font = context.parseObjectValue(arg['text-font'], i, 'text-font', array(StringType));
                    if (!font) return null;
                }

                let textColor = null;
                if (arg['text-color']) {
                    textColor = context.parseObjectValue(arg['text-color'], i, 'text-color', ColorType);
                    if (!textColor) return null;
                }

                const lastExpression = sections[sections.length - 1];
                lastExpression.scale = scale;
                lastExpression.font = font;
                lastExpression.textColor = textColor;
            } else {
                const content = context.parse(args[i], i, ValueType);
                if (!content) return null;

                const kind = content.type.kind;
                if (kind !== 'string' && kind !== 'value' && kind !== 'null' && kind !== 'resolvedImage')
                    return context.error(`Formatted text type must be 'string', 'value', 'image' or 'null'.`);

                nextTokenMayBeObject = true;
                sections.push({content, scale: null, font: null, textColor: null});
            }
        }

        return new FormatExpression(sections);
    }

    evaluate(ctx: EvaluationContext): Formatted {
        const evaluateSection = (section: FormattedSectionExpression) => {
            const evaluatedContent = section.content.evaluate(ctx);
            if (typeEquals(typeOf(evaluatedContent), ResolvedImageType)) {
                return new FormattedSection('', evaluatedContent, null, null, null);
            }

            return new FormattedSection(
                    toString(evaluatedContent),
                    null,
                    section.scale ? section.scale.evaluate(ctx) : null,
                    section.font ? section.font.evaluate(ctx).join(',') : null,
                    section.textColor ? section.textColor.evaluate(ctx) : null
            );
        };

        return new Formatted(this.sections.map(evaluateSection));
    }

    eachChild(fn: (_: Expression) => void) {
        for (const section of this.sections) {
            fn(section.content);
            if (section.scale) {
                fn(section.scale);
            }
            if (section.font) {
                fn(section.font);
            }
            if (section.textColor) {
                fn(section.textColor);
            }
        }
    }

    outputDefined(): boolean {
        // Technically the combinatoric set of all children
        // Usually, this.text will be undefined anyway
        return false;
    }

    serialize(): SerializedExpression {
        const serialized: SerializedExpression[] = ["format"];
        for (const section of this.sections) {
            serialized.push(section.content.serialize());
            const options = {} as SerializedExpression;
            if (section.scale) {
                options['font-scale'] = section.scale.serialize();
            }
            if (section.font) {
                options['text-font'] = section.font.serialize();
            }
            if (section.textColor) {
                options['text-color'] = section.textColor.serialize();
            }
            serialized.push(options);
        }
        return serialized;
    }
}
