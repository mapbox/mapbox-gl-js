// @flow

import { StringType, BooleanType, CollatorType } from '../types';

import type { Expression } from '../expression';
import type EvaluationContext from '../evaluation_context';
import type ParsingContext from '../parsing_context';
import type { Type } from '../types';

declare var Intl: {
  Collator: Class<Collator>
}

declare class Collator {
  constructor (
    locales?: string | string[],
    options?: CollatorOptions
  ): Collator;

  static (
    locales?: string | string[],
    options?: CollatorOptions
  ): Collator;

  compare (a: string, b: string): number;

  resolvedOptions(): any;
}

type CollatorOptions = {
  localeMatcher?: 'lookup' | 'best fit',
  usage?: 'sort' | 'search',
  sensitivity?: 'base' | 'accent' | 'case' | 'variant',
  ignorePunctuation?: boolean,
  numeric?: boolean,
  caseFirst?: 'upper' | 'lower' | 'false'
}

export class CollatorInstantiation {
    locale: string | null;
    sensitivity: 'base' | 'accent' | 'case' | 'variant';

    constructor(caseSensitive: boolean, diacriticSensitive: boolean, locale: string | null) {
        if (caseSensitive)
            this.sensitivity = diacriticSensitive ? 'variant' : 'case';
        else
            this.sensitivity = diacriticSensitive ? 'accent' : 'base';

        this.locale = locale;
    }

    compare(lhs: string, rhs: string): number {
        return new Intl.Collator(this.locale ? this.locale : [],
                                 { sensitivity: this.sensitivity, usage: 'search' })
            .compare(lhs, rhs);
    }

    resolvedLocale(): string {
        return new Intl.Collator(this.locale ? this.locale : [])
            .resolvedOptions().locale;
    }

    serialize() {
        const serialized = ["collator"];
        serialized.push(this.sensitivity === 'variant' || this.sensitivity === 'case');
        serialized.push(this.sensitivity === 'variant' || this.sensitivity === 'accent');
        if (this.locale) {
            serialized.push(this.locale);
        }
        return serialized;
    }
}

export class CollatorExpression implements Expression {
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

    static parse(args: Array<mixed>, context: ParsingContext): ?Expression {
        if (args.length !== 3 && args.length !== 4)
            return context.error(`Expected two or three arguments.`);

        const caseSensitive = context.parse(args[1], 1, BooleanType);
        if (!caseSensitive) return null;
        const diacriticSensitive = context.parse(args[2], 2, BooleanType);
        if (!diacriticSensitive) return null;

        let locale = null;
        if (args.length === 4) {
            locale = context.parse(args[3], 3, StringType);
            if (!locale) return null;
        }

        return new CollatorExpression(caseSensitive, diacriticSensitive, locale);
    }

    evaluate(ctx: EvaluationContext) {
        return new CollatorInstantiation(this.caseSensitive.evaluate(ctx), this.diacriticSensitive.evaluate(ctx), this.locale ? this.locale.evaluate(ctx) : null);
    }

    eachChild(fn: (Expression) => void) {
        fn(this.caseSensitive);
        fn(this.diacriticSensitive);
        if (this.locale) {
            fn(this.locale);
        }
    }

    possibleOutputs() {
        // Technically the set of possible outputs is the combinatoric set of Collators produced
        // by all possibleOutputs of locale/caseSensitive/diacriticSensitive
        // But for the primary use of Collators in comparison operators, we ignore the Collator's
        // possibleOutputs anyway, so we can get away with leaving this undefined for now.
        return [undefined];
    }

    serialize() {
        const serialized = ["collator"];
        this.eachChild(child => { serialized.push(child.serialize()); });
        return serialized;
    }
}
