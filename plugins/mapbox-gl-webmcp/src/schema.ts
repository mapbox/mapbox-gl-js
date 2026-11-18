const TYPES = {
    string: (v: unknown) => typeof v === 'string',
    number: (v: unknown) => typeof v === 'number' && Number.isFinite(v),
    integer: (v: unknown) => Number.isInteger(v),
    boolean: (v: unknown) => typeof v === 'boolean',
    null: (v: unknown) => v === null,
    array: (v: unknown) => Array.isArray(v),
    object: (v: unknown) => typeof v === 'object' && v !== null && !Array.isArray(v)
};
const KEYWORDS = new Set(['type', 'description', 'enum', 'minimum', 'maximum', 'default', 'items', 'properties', 'required', 'additionalProperties']);

type Type = keyof typeof TYPES;
type JsonSchema = {
    type?: Type | readonly Type[];
    description?: string;
    enum?: readonly (string | number | boolean | null)[];
    minimum?: number;
    maximum?: number;
    default?: unknown;
    items?: JsonSchema;
    properties?: {readonly [key: string]: JsonSchema};
    required?: readonly string[];
    additionalProperties?: boolean;
};
export type ObjectSchema = JsonSchema & {type: 'object'};

type Scalars = {string: string; number: number; integer: number; boolean: boolean; null: null};
type InferObject<P, R> =
    {-readonly [K in keyof P as K extends R ? K : P[K] extends {default: unknown} ? K : never]: Infer<P[K]>} &
    {-readonly [K in keyof P as K extends R ? never : P[K] extends {default: unknown} ? never : K]?: Infer<P[K]>};
export type Infer<S> =
    S extends {enum: readonly (infer E)[]} ? E :
    S extends {type: 'array'; items: infer I} ? Infer<I>[] :
    S extends {type: 'object'; properties: infer P} ? InferObject<P, S extends {required: readonly (infer R)[]} ? R : never> :
    S extends {type: infer T extends keyof Scalars} ? Scalars[T] :
    S extends {type: readonly (infer T extends keyof Scalars)[]} ? Scalars[T] :
    unknown;

function fail(path: string, message: string): never {
    throw new Error(path ? `${path}: ${message}` : message);
}

function received(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value === 'number' && !Number.isFinite(value) ? String(value) : typeof value;
}

export function assertSupported(schema: JsonSchema, path: string): void {
    for (const key of Object.keys(schema)) if (!KEYWORDS.has(key)) fail(path, `unsupported schema keyword "${key}"`);
    if (typeof schema.additionalProperties === 'object') fail(path, 'additionalProperties must be true or false');
    for (const type of [schema.type ?? []].flat()) if (!Object.hasOwn(TYPES, type)) fail(path, `unsupported schema type "${type}"`);
    if ('default' in schema) check(schema, schema.default, path);
    if (schema.items) assertSupported(schema.items, `${path}[]`);
    for (const [key, property] of Object.entries(schema.properties ?? {})) assertSupported(property, `${path}.${key}`);
}

export function check(schema: JsonSchema, value: unknown, path = ''): unknown {
    const types: readonly Type[] = schema.type === undefined ? [] : [schema.type].flat();
    if (types.length && !types.some((type) => TYPES[type](value))) fail(path, `expected ${types.join(' or ')}, received ${received(value)}`);
    if (schema.enum && !schema.enum.includes(value as string)) fail(path, `expected one of ${schema.enum.map((option) => JSON.stringify(option)).join(', ')}`);
    if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum) fail(path, `expected at least ${schema.minimum}`);
    if (typeof value === 'number' && schema.maximum !== undefined && value > schema.maximum) fail(path, `expected at most ${schema.maximum}`);

    const items = schema.items;
    if (Array.isArray(value) && items) return value.map((item, i) => check(items, item, `${path}[${i}]`));

    if (!TYPES.object(value)) return value;
    const properties = schema.properties ?? {};
    const object = value as Record<string, unknown>;
    const at = (key: string) => (path ? `${path}.${key}` : key);
    for (const key of Object.keys(object)) {
        if (schema.additionalProperties === false && !Object.hasOwn(properties, key)) fail(at(key), 'unknown field');
    }
    const filled = {...object};
    for (const [key, property] of Object.entries(properties)) {
        if (Object.hasOwn(object, key)) filled[key] = check(property, object[key], at(key));
        else if ('default' in property) filled[key] = check(property, structuredClone(property.default), at(key));
    }
    for (const key of schema.required ?? []) if (!Object.hasOwn(filled, key)) fail(at(key), 'missing');
    return filled;
}
