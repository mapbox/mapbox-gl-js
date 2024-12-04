import assert from 'assert';
import Grid from 'grid-index';
import Color from '../style-spec/util/color';
import {StylePropertyFunction, StyleExpression, ZoomDependentExpression, ZoomConstantExpression} from '../style-spec/expression/index';
import CompoundExpression from '../style-spec/expression/compound_expression';
import expressions from '../style-spec/expression/definitions/index';
import ResolvedImage from '../style-spec/expression/types/resolved_image';
import {ImageIdWithOptions} from '../style-spec/expression/types/image_id_with_options';
import {AJAXError} from './ajax';
import Formatted, {FormattedSection} from '../style-spec/expression/types/formatted';

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

Grid.serialize = function serialize(grid: GridIndex, transferables?: Set<Transferable>): SerializedGrid {
    const buffer = grid.toArrayBuffer();
    if (transferables) {
        transferables.add(buffer);
    }
    return {buffer};
};

Grid.deserialize = function deserialize(serialized: SerializedGrid): GridIndex {
    return new Grid(serialized.buffer);
};

Object.defineProperty(Grid, 'name', {value: 'Grid'});

register(Grid as Class<Grid>, 'Grid');

if (typeof DOMMatrix !== 'undefined') {
    register(DOMMatrix, 'DOMMatrix');
}
register(Color, 'Color');
register(Error, 'Error');
register(Formatted, 'Formatted');
register(FormattedSection, 'FormattedSection');
register(AJAXError, 'AJAXError');
register(ResolvedImage, 'ResolvedImage');
register(StylePropertyFunction, 'StylePropertyFunction');
register(StyleExpression, 'StyleExpression', {omit: ['_evaluator']});
register(ImageIdWithOptions, 'ImageIdWithOptions');

register(ZoomDependentExpression, 'ZoomDependentExpression');
register(ZoomConstantExpression, 'ZoomConstantExpression');
register(CompoundExpression, 'CompoundExpression', {omit: ['_evaluate']});
for (const name in expressions) {
    if (!registry[(expressions[name])._classRegistryKey]) register(expressions[name], `Expression${name}`);
}

function isArrayBuffer(val: any): val is ArrayBuffer {
    return val && typeof ArrayBuffer !== 'undefined' &&
           (val instanceof ArrayBuffer || (val.constructor && val.constructor.name === 'ArrayBuffer'));
}

function isImageBitmap(val: any): val is ImageBitmap {
    return self.ImageBitmap && val instanceof ImageBitmap;
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
    if (input === null ||
        input === undefined ||
        typeof input === 'boolean' ||
        typeof input === 'number' ||
        typeof input === 'string' ||
        input instanceof Boolean ||
        input instanceof Number ||
        input instanceof String ||
        input instanceof Date ||
        input instanceof RegExp) {
        return input as Serialized;
    }

    if (isArrayBuffer(input) || isImageBitmap(input)) {
        if (transferables) {
            transferables.add(input);
        }
        return input;
    }

    if (ArrayBuffer.isView(input)) {
        if (transferables) {
            transferables.add(input.buffer as ArrayBuffer);
        }
        return input;
    }

    if (input instanceof ImageData) {
        if (transferables) {
            transferables.add(input.data.buffer as ArrayBuffer);
        }
        return input;
    }

    if (Array.isArray(input)) {
        const serialized: Array<Serialized> = [];
        for (const item of input) {
            serialized.push(serialize(item, transferables));
        }
        return serialized;
    }

    if (input instanceof Map) {
        const properties: SerializedObject = {'$name': 'Map'};
        for (const [key, value] of input.entries()) {
            properties[key] = serialize(value);
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

    if (typeof input === 'object') {
        const klass = input.constructor as Klass;
        const name = klass._classRegistryKey;
        if (!name) {
            throw new Error(`Can't serialize object of unregistered class "${name}".`);
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
            for (const key in input) {
                if (!input.hasOwnProperty(key)) continue;
                if (registry[name].omit.indexOf(key) >= 0) continue;
                const property = input[key];
                properties[key] = serialize(property, transferables);
            }
            if (input instanceof Error) {
                properties['message'] = input.message;
            }
        } else {
            // make sure statically serialized object survives transfer of $name property
            assert(!transferables || !transferables.has((properties as any)));
        }

        if (properties['$name']) {
            throw new Error('$name property is reserved for worker serialization logic.');
        }
        if (name !== 'Object') {
            properties['$name'] = name;
        }

        return properties;
    }

    throw new Error(`can't serialize object of type ${typeof input}`);
}

export function deserialize(input: Serialized): unknown {
    if (input === null ||
        input === undefined ||
        typeof input === 'boolean' ||
        typeof input === 'number' ||
        typeof input === 'string' ||
        input instanceof Boolean ||
        input instanceof Number ||
        input instanceof String ||
        input instanceof Date ||
        input instanceof RegExp ||
        isArrayBuffer(input) ||
        isImageBitmap(input) ||
        ArrayBuffer.isView(input) ||
        input instanceof ImageData) {
        return input;
    }

    if (Array.isArray(input)) {
        return input.map(deserialize);
    }

    if (typeof input === 'object') {
        const name = input.$name || 'Object';

        if (name === 'Map') {
            const map = new Map();
            for (const key of Object.keys(input)) {
                if (key === '$name')
                    continue;
                const value = input[key];
                map.set(key, deserialize(value));
            }
            return map;
        }

        if (name === 'Set') {
            const set = new Set();
            for (const key of Object.keys(input)) {
                if (key === '$name')
                    continue;
                const value = input[key];
                set.add(deserialize(value));
            }
            return set;
        }

        const {klass} = registry[name];
        if (!klass) {
            throw new Error(`Can't deserialize unregistered class "${name}".`);
        }

        if (klass.deserialize) {
            return klass.deserialize(input);
        }

        const result: Record<string, unknown> = Object.create(klass.prototype);

        for (const key of Object.keys(input)) {
            if (key === '$name')
                continue;
            const value = input[key];
            result[key] = deserialize(value);
        }

        return result;
    }

    throw new Error(`can't deserialize object of type ${typeof input}`);
}
