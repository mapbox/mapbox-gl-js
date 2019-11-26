function isPrimitive(value: any) {
    return value instanceof Number || value instanceof String || value instanceof Boolean;
}

// Turn jsonlint-lines-primitives objects into primitive objects
export function unbundle(value: any) {
    if (isPrimitive(value)) {
        return value.valueOf();
    } else {
        return value;
    }
}

export function deepUnbundle(value: any): any {
    if (Array.isArray(value)) {
        return value.map(deepUnbundle);
    } else if (value instanceof Object && !isPrimitive(value)) {
        const unbundledValue: { [key: string]: mixed } = {};
        for (const key in value) {
            unbundledValue[key] = deepUnbundle(value[key]);
        }
        return unbundledValue;
    }

    return unbundle(value);
}
