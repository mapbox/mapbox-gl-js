import assert from 'assert';
import Grid from 'grid-index';
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
import type {GridIndex} from '../types/grid-index';
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

type SerializedGrid = {
    buffer: ArrayBuffer;
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
Grid.serialize = function serialize(grid: GridIndex, transferables?: Set<Transferable>): SerializedGrid {
    const buffer = grid.toArrayBuffer();
    if (transferables) {
        transferables.add(buffer);
    }
    return {buffer};
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
Grid.deserialize = function deserialize(serialized: SerializedGrid): GridIndex {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return new Grid(serialized.buffer) as GridIndex;
};

Object.defineProperty(Grid, 'name', {value: 'Grid'});

register(Grid as Class<Grid>, 'Grid');

// serialize points as objects
delete Point.prototype.constructor;

register(Color, 'Color');
register(Error, 'Error');
register(Formatted, 'Formatted');
register(FormattedSection, 'FormattedSection');
register(AJAXError, 'AJAXError');
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

    const klass = input.constructor as Klass;
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
        if (input instanceof Error) {
            properties['message'] = input.message;
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
