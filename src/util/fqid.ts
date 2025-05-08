import type {Brand} from '../style-spec/types/brand';

/**
 * A Fully Qualified ID (FQID) is a string that contains some ID and a scope.
 */
export type FQID<T> = Brand<string, T>;

const FQIDSeparator = '\u001F';

export function isFQID(id: string): boolean {
    return id.indexOf(FQIDSeparator) >= 0;
}

export function makeFQID<T = string>(name: T, scope?: string | null): FQID<T> {
    if (!scope) return name as FQID<T>;
    return `${name}${FQIDSeparator}${scope}` as FQID<T>;
}

export function getNameFromFQID<T>(fqid: FQID<T>): T;
export function getNameFromFQID(fqid: string): string;
export function getNameFromFQID<T>(fqid: FQID<T> | string): T | string {
    const sep = fqid.indexOf(FQIDSeparator);
    return (sep >= 0 ? fqid.slice(0, sep) : fqid);
}

/**
 * Extracts the scope portion from a Fully Qualified ID.
 * When dealing with nested scopes, returns the rightmost scope segment.
 * @param fqid - The Fully Qualified ID to extract from
 * @returns The scope part of the FQID, or an empty string if no separator is found
 * @example
 * getInnerScopeFromFQID('name scope1') // returns 'scope1'
 * getInnerScopeFromFQID('name scope2 scope1') // returns 'scope1'
 */
export function getInnerScopeFromFQID(fqid: string): string {
    const sep = fqid.lastIndexOf(FQIDSeparator);
    return sep >= 0 ? fqid.slice(sep + 1) : '';
}

/**
 * Extracts the full scope portion from a Fully Qualified ID.
 * When dealing with nested scopes, returns everything after the first separator, i.e. all nested scopes.
 * @param fqid - The Fully Qualified ID to extract from
 * @returns The full scope string, or an empty string if no separator is found
 * @example
 * getOuterScopeFromFQID('name scope1') // returns 'scope1'
 * getOuterScopeFromFQID('name scope2 scope1') // returns 'scope2 scope1'
 */
export function getOuterScopeFromFQID(fqid: string): string {
    const sep = fqid.indexOf(FQIDSeparator);
    return sep >= 0 ? fqid.slice(sep + 1) : '';
}
