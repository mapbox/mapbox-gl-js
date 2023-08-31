// @flow

const FQIDSeparator = '\u001F';

export function isFQID(id: string): boolean {
    return id.indexOf(FQIDSeparator) >= 0;
}

export function makeFQID(id: string, scope: ?string): string {
    if (!scope) return id;
    return `${id}${FQIDSeparator}${scope}`;
}

export function getNameFromFQID(fqid: string): string {
    const sep = fqid.indexOf(FQIDSeparator);
    return sep >= 0 ? fqid.slice(0, sep) : fqid;
}

export function getScopeFromFQID(fqid: string): string {
    const sep = fqid.indexOf(FQIDSeparator);
    return sep >= 0 ? fqid.slice(sep + 1) : '';
}
