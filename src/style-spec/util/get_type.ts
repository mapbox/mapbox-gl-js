export function getType(val: unknown): "number" | "string" | "boolean" | "array" | "null" | "object" | "function" | "bigint" | "symbol" | "undefined" | "NaN" {
    if (isString(val)) return 'string';
    if (isNumber(val)) return 'number';
    if (isBoolean(val)) return 'boolean';
    if (Array.isArray(val)) return 'array';
    if (val === null) return 'null';
    if (isObject(val)) return 'object';
    return typeof val;
}

export function isObject(value: unknown): value is Record<PropertyKey, unknown> {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return false;
    if (typeof value === 'function') return false;
    if (value instanceof String || value instanceof Number || value instanceof Boolean) {
        return false;
    }
    return typeof value === 'object';
}

export function isString(value: unknown): value is string {
    return typeof value === 'string' || value instanceof String;
}

export function isNumber(value: unknown): value is number {
    return typeof value === 'number' || value instanceof Number;
}

export function isBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean' || value instanceof Boolean;
}
