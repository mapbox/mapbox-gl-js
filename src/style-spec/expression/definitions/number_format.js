// @flow

import {StringType, NumberType} from '../types.js';

import type {Expression, SerializedExpression} from '../expression.js';
import type EvaluationContext from '../evaluation_context.js';
import type ParsingContext from '../parsing_context.js';
import type {Type} from '../types.js';

declare var Intl: {
    NumberFormat: Class<Intl$NumberFormat>
};

declare class Intl$NumberFormat {
    constructor (
        locales?: string | string[],
        options?: NumberFormatOptions
    ): Intl$NumberFormat;

    static (
        locales?: string | string[],
        options?: NumberFormatOptions
    ): Intl$NumberFormat;

    format(a: number): string;

    resolvedOptions(): any;
}

type NumberFormatOptions = {
    style?: 'decimal' | 'currency' | 'percent' | 'unit';
    currency?: null | string;
    unit?: null | string;
    minimumFractionDigits?: null | string;
    maximumFractionDigits?: null | string;
};

export default class NumberFormat implements Expression {
    type: Type;
    number: Expression;
    locale: Expression | null;   // BCP 47 language tag
    currency: Expression | null; // ISO 4217 currency code, required if style=currency
    unit: Expression | null;     // Simple units sanctioned for use in ECMAScript, required if style=unit. https://tc39.es/proposal-unified-intl-numberformat/section6/locales-currencies-tz_proposed_out.html#sec-issanctionedsimpleunitidentifier
    minFractionDigits: Expression | null; // Default 0
    maxFractionDigits: Expression | null; // Default 3

    constructor(number: Expression,
                locale: Expression | null,
                currency: Expression | null,
                unit: Expression | null,
                minFractionDigits: Expression | null,
                maxFractionDigits: Expression | null) {
        this.type = StringType;
        this.number = number;
        this.locale = locale;
        this.currency = currency;
        this.unit = unit;
        this.minFractionDigits = minFractionDigits;
        this.maxFractionDigits = maxFractionDigits;
    }

    static parse(args: $ReadOnlyArray<mixed>, context: ParsingContext): ?Expression {
        if (args.length !== 3)
            return context.error(`Expected two arguments.`);

        const number = context.parse(args[1], 1, NumberType);
        if (!number) return null;

        const options = (args[2]: any);
        if (typeof options !== "object" || Array.isArray(options))
            return context.error(`NumberFormat options argument must be an object.`);

        let locale = null;
        if (options['locale']) {
            locale = context.parse(options['locale'], 1, StringType);
            if (!locale) return null;
        }

        let currency = null;
        if (options['currency']) {
            currency = context.parse(options['currency'], 1, StringType);
            if (!currency) return null;
        }

        let unit = null;
        if (options['unit']) {
            unit = context.parse(options['unit'], 1, StringType);
            if (!unit) return null;
        }

        let minFractionDigits = null;
        if (options['min-fraction-digits']) {
            minFractionDigits = context.parse(options['min-fraction-digits'], 1, NumberType);
            if (!minFractionDigits) return null;
        }

        let maxFractionDigits = null;
        if (options['max-fraction-digits']) {
            maxFractionDigits = context.parse(options['max-fraction-digits'], 1, NumberType);
            if (!maxFractionDigits) return null;
        }

        return new NumberFormat(number, locale, currency, unit, minFractionDigits, maxFractionDigits);
    }

    evaluate(ctx: EvaluationContext): string {
        return new Intl.NumberFormat(this.locale ? this.locale.evaluate(ctx) : [],
            {
                style:
                    (this.currency && "currency") ||
                    (this.unit && "unit") ||
                    "decimal",
                currency: this.currency ? this.currency.evaluate(ctx) : undefined,
                unit: this.unit ? this.unit.evaluate(ctx) : undefined,
                minimumFractionDigits: this.minFractionDigits ? this.minFractionDigits.evaluate(ctx) : undefined,
                maximumFractionDigits: this.maxFractionDigits ? this.maxFractionDigits.evaluate(ctx) : undefined,
            }).format(this.number.evaluate(ctx));
    }

    eachChild(fn: (_: Expression) => void) {
        fn(this.number);
        if (this.locale) {
            fn(this.locale);
        }
        if (this.currency) {
            fn(this.currency);
        }
        if (this.unit) {
            fn(this.unit);
        }
        if (this.minFractionDigits) {
            fn(this.minFractionDigits);
        }
        if (this.maxFractionDigits) {
            fn(this.maxFractionDigits);
        }
    }

    outputDefined(): boolean {
        return false;
    }

    serialize(): SerializedExpression {
        const options = {};
        if (this.locale) {
            options['locale'] = this.locale.serialize();
        }
        if (this.currency) {
            options['currency'] = this.currency.serialize();
        }
        if (this.unit) {
            options['unit'] = this.unit.serialize();
        }
        if (this.minFractionDigits) {
            options['min-fraction-digits'] = this.minFractionDigits.serialize();
        }
        if (this.maxFractionDigits) {
            options['max-fraction-digits'] = this.maxFractionDigits.serialize();
        }
        return ["number-format", this.number.serialize(), options];
    }
}
