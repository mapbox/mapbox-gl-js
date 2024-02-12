// @flow strict

// Flow type declarations for Intl cribbed from
// https://github.com/facebook/flow/issues/1270

declare var Intl: {
    NumberFormat: Class<Intl$NumberFormat>;
    Collator: Class<Intl$Collator>;
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

declare class Intl$Collator {
    constructor (
        locales?: string | string[],
        options?: CollatorOptions
    ): Intl$Collator;

    static (
        locales?: string | string[],
        options?: CollatorOptions
    ): Intl$Collator;

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
