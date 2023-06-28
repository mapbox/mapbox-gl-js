// @flow

const FQIDSeparator = '\u001F';

export function makeFQID(id: string, namespace: ?string): string {
    if (!namespace) return id;
    return `${id}${FQIDSeparator}${namespace}`;
}

export function getNameFromFQID(fqid: string): string {
    const sep = fqid.indexOf(FQIDSeparator);
    return sep >= 0 ? fqid.slice(0, sep) : fqid;
}
