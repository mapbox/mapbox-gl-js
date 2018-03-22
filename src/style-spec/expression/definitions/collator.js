// @flow

import { StringType, BooleanType, CollatorType } from '../types';

import type { Expression } from '../expression';
import type EvaluationContext from '../evaluation_context';
import type ParsingContext from '../parsing_context';
import type { Type } from '../types';

export class Collator {
    locale: string;
    sensitivity: string;

    constructor(caseSensitive: boolean, diacriticSensitive: boolean, locale: string) {
        if (caseSensitive)
            this.sensitivity = diacriticSensitive ? 'variant' : 'case';
        else
            this.sensitivity = diacriticSensitive ? 'accent' : 'base';

        this.locale = locale;
    }

    compare(lhs: string, rhs: string): number {
        return new Intl.Collator(this.locale ? this.locale : {},
                                 { sensitivity: this.sensitivity, usage: 'search' })
            .compare(lhs, rhs);
    }
}

export class CollatorExpression implements Expression {
    type: Type;
    caseSensitive: Expression;
    diacriticSensitive: Expression;
    locale: Expression;

    constructor(caseSensitive: Expression, diacriticSensitive, locale: Expression) {
        this.type = CollatorType;
        this.locale = locale;
        this.caseSensitive = caseSensitive;
        this.diacriticSensitive = diacriticSensitive;
    }

    static parse(args: Array<mixed>, context: ParsingContext): ?Expression {
        if (args.length !== 3 && args.length !== 4)
            return context.error(`Expected two or three arguments.`);

        const caseSensitive = context.parse(args[1], 1, BooleanType);
        if (!caseSensitive) return null;
        const diacriticSensitive = context.parse(args[2], 2, BooleanType);
        if (!diacriticSensitive) return null;

        let locale;
        if (args.length === 4) {
            locale = context.parse(args[3], 3, StringType);
            if (!locale) return null;
        }

        return new CollatorExpression(caseSensitive, diacriticSensitive, locale);
    }

    evaluate(ctx: EvaluationContext) {
        return new Collator(this.caseSensitive.evaluate(ctx), this.diacriticSensitive.evaluate(ctx), this.locale ? this.locale.evaluate(ctx) : null);
    }

    eachChild(fn: (Expression) => void) {
        fn(this.locale);
        fn(this.caseSensitive);
        fn(this.diacriticSensitive);
    }

    possibleOutputs() {
        // TODO: I'm not sure how to implement this?
        return [undefined];
    }
}
