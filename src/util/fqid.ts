import type {Brand} from '../style-spec/types/brand';

/**
 * A Fully Qualified ID (FQID) is a string that contains some ID and a scope.
 */
export type FQID<T> = Brand<string, T>;

const FQIDSeparator = '\u001F';

export function isFQID(id: string): boolean {
    return id.indexOf(FQIDSeparator) >= 0;
}

export function makeFQID<T = string>(id: T, scope?: string | null): FQID<T> {
    if (!scope) return id as FQID<T>;
    return `${id}${FQIDSeparator}${scope}` as FQID<T>;
}

export function getNameFromFQID<T>(fqid: FQID<T>): T;
export function getNameFromFQID(fqid: string): string;
export function getNameFromFQID<T>(fqid: FQID<T> | string): T | string {
    const sep = fqid.indexOf(FQIDSeparator);
    return (sep >= 0 ? fqid.slice(0, sep) : fqid);
}

export function getScopeFromFQID(fqid: string): string {
    const sep = fqid.indexOf(FQIDSeparator);
    return sep >= 0 ? fqid.slice(sep + 1) : '';
}
