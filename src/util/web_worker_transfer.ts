import assert from '../style-spec/util/assert';
import Grid from '../symbol/grid_index';
import Color from '../style-spec/util/color';
import Point from '@mapbox/point-geometry';
import {StylePropertyFunction, StyleExpression, ZoomDependentExpression, ZoomConstantExpression} from '../style-spec/expression/index';
import CompoundExpression from '../style-spec/expression/compound_expression';
import expressions from '../style-spec/expression/definitions/index';
import ResolvedImage from '../style-spec/expression/types/resolved_image';
import {AJAXError} from './ajax';
import Formatted, {FormattedSection} from '../style-spec/expression/types/formatted';
import {ImageId} from '../style-spec/expression/types/image_id';
import {ImageVariant} from '../style-spec/expression/types/image_variant';

import type {Class} from '../types/class';
import type {Transferable} from '../types/transferable';

type SerializedObject = {
    $name?: string;
    message?: string;
    [_: string]: Serialized;
};

export type Serialized =
    | null
    | undefined
    | boolean
    | number
    | string
    | Date
    | RegExp
    | ArrayBuffer
    | ArrayBufferView
    | ImageData
    | ImageBitmap
    | Array<Serialized>
    | SerializedObject;

/**
 * A class that can be serialized and deserialized.
 */
type Klass<T extends Class<unknown> = Class<unknown>> = T & {
    _classRegistryKey?: string;
    serialize?: (input: unknown, transferables?: Set<Transferable>) => SerializedObject;
    deserialize?: (input: Serialized) => unknown;
};

type Registry = Record<string, {
    klass: Klass;
    omit: ReadonlyArray<string>;
}>;

type RegisterOptions<T extends Class<unknown>> = {
    omit?: ReadonlyArray<keyof InstanceType<T>>;
};

const registry: Registry = {};

/**
 * Register the given class as serializable.
 *
 * @param options
 * @param options.omit List of properties to omit from serialization (e.g., cached/computed properties)
 *
 * @private
 */
export function register<T extends Class<unknown>>(klass: T, name: string, options: RegisterOptions<T> = {}) {
    assert(name, 'Can\'t register a class without a name.');
    assert(!registry[name], `Class "${name}" is already registered.`);

    Object.defineProperty(klass, '_classRegistryKey', {
        value: name,
        writable: false
    });

    registry[name] = {
        klass,
        omit: options.omit || []
    } as Registry[string];
}

register(Object, 'Object');

register(Grid as Class<Grid>, 'Grid');

// serialize points as objects
delete Point.prototype.constructor;

register(Color, 'Color');
register(Formatted, 'Formatted');
register(FormattedSection, 'FormattedSection');
register(ResolvedImage, 'ResolvedImage');
register(StylePropertyFunction, 'StylePropertyFunction');
register(StyleExpression, 'StyleExpression', {omit: ['_evaluator']});
register(ImageId, 'ImageId');
register(ImageVariant, 'ImageVariant');

register(ZoomDependentExpression, 'ZoomDependentExpression');
register(ZoomConstantExpression, 'ZoomConstantExpression');
register(CompoundExpression, 'CompoundExpression', {omit: ['_evaluate']});
for (const name in expressions) {
    if (!registry[(expressions[name])._classRegistryKey]) register(expressions[name], `Expression${name}`);
}

function isArrayBuffer(val: unknown): val is ArrayBuffer {
    return val && (val instanceof ArrayBuffer || (val.constructor && val.constructor.name === 'ArrayBuffer'));
}

const ERROR_CTORS: Record<string, ErrorConstructor> = {
    Error,
    TypeError,
    RangeError,
    SyntaxError,
    ReferenceError,
    URIError,
    EvalError
};

const ERROR_PROPERTIES = new Set(['message', 'stack', 'cause', 'errors', 'name', 'class']);

/**
 * Serialize the given object for transfer to or from a web worker.
 *
 * For non-builtin types, recursively serialize each property (possibly
 * omitting certain properties - see register()), and package the result along
 * with the constructor's `name` so that the appropriate constructor can be
 * looked up in `deserialize()`.
 *
 * If a `transferables` set is provided, add any transferable objects (i.e.,
 * any ArrayBuffers or ArrayBuffer views) to the list. (If a copy is needed,
 * this should happen in the client code, before using serialize().)
 *
 * @private
 */
export function serialize(input: unknown, transferables?: Set<Transferable> | null): Serialized {
    if (input === null) return null;
    const type = typeof input;
    if (type !== 'object') {
        if (type === 'bigint') return {$name: 'BigInt', value: (input as bigint).toString()};
        return input as Serialized;
    }

    if (Array.isArray(input)) {
        const length = input.length;
        const serialized: Array<Serialized> = [];
        serialized.length = length;
        for (let i = 0; i < length; i++) {
            serialized[i] = serialize(input[i], transferables);
        }
        return serialized;
    }

    if (ArrayBuffer.isView(input)) {
        if (transferables) {
            transferables.add(input.buffer as ArrayBuffer);
        }
        return input;
    }

    if (isArrayBuffer(input) || input instanceof ImageBitmap) {
        if (transferables) {
            transferables.add(input);
        }
        return input;
    }

    if (input instanceof ImageData) {
        if (transferables) {
            transferables.add(input.data.buffer);
        }
        return input;
    }

    if (input instanceof Map) {
        const properties = {'$name': 'Map', entries: []} satisfies SerializedObject;
        for (const [key, value] of input.entries()) {
            properties.entries.push(serialize(key), serialize(value, transferables));
        }
        return properties;
    }

    if (input instanceof Headers) {
        return {'$name': 'Headers', entries: [...input]} satisfies SerializedObject;
    }

    if (input instanceof Set) {
        const properties: SerializedObject = {'$name': 'Set'};
        let idx = 0;
        for (const value of input.values()) {
            properties[++idx] = serialize(value);
        }
        return properties;
    }

    if (input instanceof Date || input instanceof RegExp ||
        input instanceof Boolean || input instanceof Number || input instanceof String) {
        return input as Serialized;
    }

    if (input instanceof Error) {
        const err = input as Error & {cause?: unknown};
        const ctorName = (err.constructor && err.constructor.name) || 'Error';

        const cls =
            err instanceof AJAXError ? 'AJAXError' :
            err instanceof DOMException ? 'DOMException' :
            err instanceof AggregateError ? 'AggregateError' :
            (ERROR_CTORS[ctorName] ? ctorName : 'Error');

        const out: SerializedObject = {
            $name: '$Error',
            class: cls,
            name: err.name,
            message: err.message
        };

        if (err.stack) out.stack = err.stack;
        if ('cause' in err && err.cause !== err) out.cause = serialize(err.cause, transferables);

        if (err instanceof AggregateError) {
            out.errors = (err.errors as unknown[])
                .filter((e) => e !== err)
                .map((e) => serialize(e, transferables));
        }

        const obj = err as unknown as Record<string, unknown>;
        for (const key in obj) {
            if (!Object.hasOwn(obj, key)) continue;
            if (ERROR_PROPERTIES.has(key)) continue;
            out[key] = serialize(obj[key], transferables);
        }

        return out;
    }

    // Null-prototype objects (e.g. Object.create(null)) have no inherited
    // `constructor`, so fall back to the plain-Object codepath. They serialize
    // as plain dicts and round-trip as regular {} on the worker side.
    const klass = (input.constructor || Object) as Klass;
    const name = klass._classRegistryKey;
    if (!name) {
        throw new Error(`Can't serialize object of unregistered class "${klass.name}".`);
    }
    assert(registry[name]);

    const properties: SerializedObject = klass.serialize ?
        // (Temporary workaround) allow a class to provide static
        // `serialize()` and `deserialize()` methods to bypass the generic
        // approach.
        // This temporary workaround lets us use the generic serialization
        // approach for objects whose members include instances of dynamic
        // StructArray types. Once we refactor StructArray to be static,
        // we can remove this complexity.
        klass.serialize(input, transferables) : {};

    if (!klass.serialize) {
        const omit = registry[name].omit;
        const obj = input as Record<string, unknown>;
        for (const key in obj) {
            if (!Object.hasOwn(obj, key)) continue;
            if (omit.includes(key)) continue;
            properties[key] = serialize(obj[key], transferables);
        }
    } else {
        // make sure statically serialized object survives transfer of $name property
        assert(!transferables || !transferables.has(properties as unknown as Transferable));
    }

    if (properties['$name']) {
        throw new Error('$name property is reserved for worker serialization logic.');
    }
    if (name !== 'Object') {
        properties['$name'] = name;
    }

    return properties;
}

export function deserialize(input: Serialized): unknown {
    if (input === null || typeof input !== 'object') return input;

    if (Array.isArray(input)) {
        for (let i = 0; i < input.length; i++) {
            input[i] = deserialize(input[i]) as Serialized;
        }
        return input;
    }

    if (ArrayBuffer.isView(input) || isArrayBuffer(input) ||
        input instanceof ImageBitmap || input instanceof ImageData ||
        input instanceof Date || input instanceof RegExp ||
        input instanceof Boolean || input instanceof Number || input instanceof String) {
        return input;
    }

    const name = input.$name || 'Object';

    if (name === 'Map') {
        const entries = input.entries as Array<[Serialized, Serialized]> || [];
        const map = new Map();
        for (let i = 0; i < entries.length; i += 2) {
            map.set(deserialize(entries[i]), deserialize(entries[i + 1]));
        }
        return map;
    }

    if (name === 'Headers') {
        return new Headers(input.entries as HeadersInit);
    }

    if (name === 'Set') {
        const set = new Set();
        for (const key in input) {
            if (key === '$name') continue;
            set.add(deserialize(input[key]));
        }
        return set;
    }

    if (name === 'BigInt') {
        return BigInt(input.value as string);
    }

    if (name === '$Error') {
        const cls = (input.class as string) || 'Error';
        const errName = (input.name as string) || cls;
        const message = input.message || '';

        let err: Error;
        if (cls === 'DOMException') {
            err = new DOMException(message, errName);
        } else if (cls === 'AggregateError') {
            err = new AggregateError(((input.errors as Serialized[]) || []).map(deserialize), message);
        } else if (cls === 'AJAXError') {
            err = new AJAXError(input.statusText as string, input.status as number, input.url as string);
        } else {
            const C = ERROR_CTORS[cls] || Error;
            err = new C(message);
        }

        // DOMException.name is readonly
        if (cls !== 'DOMException') err.name = errName;
        if (input.stack) err.stack = input.stack as string;
        if ('cause' in input) (err as Error & {cause?: unknown}).cause = deserialize(input.cause);

        const obj = err as unknown as Record<string, unknown>;
        for (const key in input) {
            if (!Object.hasOwn(input, key)) continue;
            if (key === '$name' || ERROR_PROPERTIES.has(key)) continue;
            obj[key] = deserialize(input[key]);
        }

        return err;
    }

    const {klass} = registry[name];
    if (!klass) {
        throw new Error(`Can't deserialize unregistered class "${name}".`);
    }

    if (klass.deserialize) {
        return klass.deserialize(input);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument
    const result: Record<string, unknown> = Object.create(klass.prototype);

    for (const key in input) {
        if (key === '$name') continue;
        result[key] = deserialize(input[key]);
    }

    return result;
}
