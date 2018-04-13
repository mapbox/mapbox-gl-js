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
        const options = {};
        options['caseSensitive'] = this.sensitivity === 'variant' || this.sensitivity === 'case';
        options['diacriticSensitive'] = this.sensitivity === 'variant' || this.sensitivity === 'accent';
        if (this.locale) {
            options['locale'] = this.locale;
        }
        return ["collator", options];
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
        if (args.length !== 2)
            return context.error(`Expected one argument.`);

        const options = (args[1]: any);
        if (typeof options !== "object" || Array.isArray(options))
            return context.error(`Collator options argument must be an object.`);

        const caseSensitive = context.parse(
            options['caseSensitive'] === undefined ? false : options['caseSensitive'], 1, BooleanType);
        if (!caseSensitive) return null;

        const diacriticSensitive = context.parse(
            options['diacriticSensitive'] === undefined ? false : options['diacriticSensitive'], 2, BooleanType);
        if (!diacriticSensitive) return null;

        let locale = null;
        if (options['locale']) {
            locale = context.parse(options['locale'], 3, StringType);
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
        const options = {};
        options['caseSensitive'] = this.caseSensitive;
        options['diacriticSensitive'] = this.diacriticSensitive;
        if (this.locale) {
            options['locale'] = this.locale;
        }
        return ["collator", options];
    }
}
