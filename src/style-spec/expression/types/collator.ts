export default class Collator {
    locale: string | null;
    sensitivity: 'base' | 'accent' | 'case' | 'variant';
    collator: Intl.Collator;

    constructor(caseSensitive: boolean, diacriticSensitive: boolean, locale: string | null) {
        if (caseSensitive)
            this.sensitivity = diacriticSensitive ? 'variant' : 'case';
        else
            this.sensitivity = diacriticSensitive ? 'accent' : 'base';

        this.locale = locale;
        this.collator = new Intl.Collator(this.locale ? this.locale : [],
            {sensitivity: this.sensitivity, usage: 'search'});
    }

    compare(lhs: string, rhs: string): number {
        return this.collator.compare(lhs, rhs);
    }

    resolvedLocale(): string {
        // We create a Collator without "usage: search" because we don't want
        // the search options encoded in our result (e.g. "en-u-co-search")
        return new Intl.Collator(this.locale ? this.locale : [])
            .resolvedOptions().locale;
    }
}
