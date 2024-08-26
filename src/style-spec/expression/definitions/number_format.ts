import {StringType, NumberType} from '../types';

import type {Expression, SerializedExpression} from '../expression';
import type EvaluationContext from '../evaluation_context';
import type ParsingContext from '../parsing_context';
import type {Type} from '../types';

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

    static parse(args: ReadonlyArray<unknown>, context: ParsingContext): Expression | null | undefined {
        if (args.length !== 3)
        // @ts-expect-error - TS2322 - Type 'void' is not assignable to type 'Expression'.
            return context.error(`Expected two arguments.`);

        const number = context.parse(args[1], 1, NumberType);
        if (!number) return null;

        const options = (args[2] as any);
        if (typeof options !== "object" || Array.isArray(options))
        // @ts-expect-error - TS2322 - Type 'void' is not assignable to type 'Expression'.
            return context.error(`NumberFormat options argument must be an object.`);

        let locale = null;
        if (options['locale']) {
            locale = context.parseObjectValue(options['locale'], 2, 'locale', StringType);
            if (!locale) return null;
        }

        let currency = null;
        if (options['currency']) {
            currency = context.parseObjectValue(options['currency'], 2, 'currency', StringType);
            if (!currency) return null;
        }

        let unit = null;
        if (options['unit']) {
            unit = context.parseObjectValue(options['unit'], 2, 'unit', StringType);
            if (!unit) return null;
        }

        let minFractionDigits = null;
        if (options['min-fraction-digits']) {
            minFractionDigits = context.parseObjectValue(options['min-fraction-digits'], 2, 'min-fraction-digits', NumberType);
            if (!minFractionDigits) return null;
        }

        let maxFractionDigits = null;
        if (options['max-fraction-digits']) {
            maxFractionDigits = context.parseObjectValue(options['max-fraction-digits'], 2, 'max-fraction-digits', NumberType);
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
        const options: Record<string, any> = {};
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
