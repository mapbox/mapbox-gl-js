// Turn jsonlint-lines-primitives objects into primitive objects
export function unbundle(value: unknown): unknown {
    if (value instanceof Number || value instanceof String || value instanceof Boolean) {
        return value.valueOf();
    } else {
        return value;
    }
}

export function deepUnbundle(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(deepUnbundle);
    } else if (value instanceof Object && !(value instanceof Number || value instanceof String || value instanceof Boolean)) {
        const unbundledValue: {
            [key: string]: unknown;
        } = {};
        for (const key in value) {
            unbundledValue[key] = deepUnbundle(value[key]);
        }
        return unbundledValue;
    }

    return unbundle(value);
}
