import {StringType, BooleanType, CollatorType} from '../types';
import Collator from '../types/collator';

import type {Expression, SerializedExpression} from '../expression';
import type EvaluationContext from '../evaluation_context';
import type ParsingContext from '../parsing_context';
import type {Type} from '../types';

export default class CollatorExpression implements Expression {
    type: Type;
    caseSensitive: Expression;
    diacriticSensitive: Expression;
    locale: Expression | null;

    constructor(caseSensitive: Expression, diacriticSensitive: Expression, locale: Expression | null) {
        this.type = CollatorType;
        this.locale = locale;
        this.caseSensitive = caseSensitive;
        this.diacriticSensitive = diacriticSensitive;
    }

    static parse(args: ReadonlyArray<unknown>, context: ParsingContext): Expression | null | undefined {
        if (args.length !== 2)
        // @ts-expect-error - TS2322 - Type 'void' is not assignable to type 'Expression'.
            return context.error(`Expected one argument.`);

        const options = (args[1] as any);
        if (typeof options !== "object" || Array.isArray(options))
        // @ts-expect-error - TS2322 - Type 'void' is not assignable to type 'Expression'.
            return context.error(`Collator options argument must be an object.`);

        const caseSensitive = options['case-sensitive'] === undefined ?
            context.parse(false, 1, BooleanType) :
            context.parseObjectValue(options['case-sensitive'], 1, 'case-sensitive', BooleanType);
        if (!caseSensitive) return null;

        const diacriticSensitive = options['diacritic-sensitive'] === undefined ?
            context.parse(false, 1, BooleanType) :
            context.parseObjectValue(options['diacritic-sensitive'], 1, 'diacritic-sensitive', BooleanType);
        if (!diacriticSensitive) return null;

        let locale = null;
        if (options['locale']) {
            locale = context.parseObjectValue(options['locale'], 1, 'locale', StringType);
            if (!locale) return null;
        }

        return new CollatorExpression(caseSensitive, diacriticSensitive, locale);
    }

    evaluate(ctx: EvaluationContext): Collator {
        return new Collator(this.caseSensitive.evaluate(ctx), this.diacriticSensitive.evaluate(ctx), this.locale ? this.locale.evaluate(ctx) : null);
    }

    eachChild(fn: (_: Expression) => void) {
        fn(this.caseSensitive);
        fn(this.diacriticSensitive);
        if (this.locale) {
            fn(this.locale);
        }
    }

    outputDefined(): boolean {
        // Technically the set of possible outputs is the combinatoric set of Collators produced
        // by all possible outputs of locale/caseSensitive/diacriticSensitive
        // But for the primary use of Collators in comparison operators, we ignore the Collator's
        // possible outputs anyway, so we can get away with leaving this false for now.
        return false;
    }

    serialize(): SerializedExpression {
        const options: Record<string, any> = {};
        options['case-sensitive'] = this.caseSensitive.serialize();
        options['diacritic-sensitive'] = this.diacriticSensitive.serialize();
        if (this.locale) {
            options['locale'] = this.locale.serialize();
        }
        return ["collator", options];
    }
}
