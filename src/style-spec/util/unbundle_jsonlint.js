// @flow

// Turn jsonlint-lines-primitives objects into primitive objects
export function unbundle(value: mixed) {
    if (value instanceof Number || value instanceof String || value instanceof Boolean) {
        return value.valueOf();
    } else {
        return value;
    }
}

export function deepUnbundle(value: mixed): mixed {
    if (Array.isArray(value)) {
        return value.map(deepUnbundle);
    } else if (value instanceof Object && !(value instanceof Number || value instanceof String || value instanceof Boolean)) {
        const unbundledValue: { [key: string]: mixed } = {};
        for (const key in value) {
            unbundledValue[key] = deepUnbundle(value[key]);
        }
        return unbundledValue;
    }

    return unbundle(value);
}
