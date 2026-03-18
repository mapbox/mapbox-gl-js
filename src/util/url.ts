export function getURLExtension(url: string): string {
    try {
        const lastSegment = new URL(url).pathname.split('/').pop() || '';
        const dotIndex = lastSegment.lastIndexOf('.');
        return dotIndex >= 0 ? lastSegment.slice(dotIndex + 1) : '';
    } catch {
        return '';
    }
}

export function setQueryParameters(
    url: string,
    params: {
        [key: string]: string;
    },
): string {
    const paramStart = url.indexOf('?');
    if (paramStart < 0) return `${url}?${new URLSearchParams(params).toString()}`;

    const searchParams = new URLSearchParams(url.slice(paramStart));
    for (const key in params) {
        searchParams.set(key, params[key]);
    }

    return `${url.slice(0, paramStart)}?${searchParams.toString()}`;
}

type StripQueryParameters = {
    persistentParams: string[];
};

export function stripQueryParameters(url: string, params: StripQueryParameters = {persistentParams: []}): string {
    const paramStart = url.indexOf('?');
    if (paramStart < 0) return url;

    const nextParams = new URLSearchParams();
    const searchParams = new URLSearchParams(url.slice(paramStart));
    for (const param of params.persistentParams) {
        const value = searchParams.get(param);
        if (value) nextParams.set(param, value);
    }

    const nextParamsString = nextParams.toString();

    return `${url.slice(0, paramStart)}${nextParamsString.length > 0 ? `?${nextParamsString}` : ''}`;
}
