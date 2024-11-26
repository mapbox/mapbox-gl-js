import assert from 'assert';
import Grid from 'grid-index';
import Color from '../style-spec/util/color';
import {StylePropertyFunction, StyleExpression, ZoomDependentExpression, ZoomConstantExpression} from '../style-spec/expression/index';
import CompoundExpression from '../style-spec/expression/compound_expression';
import expressions from '../style-spec/expression/definitions/index';
import ResolvedImage from '../style-spec/expression/types/resolved_image';
import {AJAXError} from './ajax';
import Formatted, {FormattedSection} from '../style-spec/expression/types/formatted';

import type {Class} from '../types/class';
import type {GridIndex} from '../types/grid-index';
import type {Transferable} from '../types/transferable';

type SerializedObject = {
    [_: string]: Serialized;
};

export type Serialized = null | undefined | boolean | number | string | Date | RegExp | ArrayBuffer | ArrayBufferView | ImageData | Array<Serialized> | SerializedObject;

type Klass = Class<any> & {
    _classRegistryKey: string;
    serialize?: (input: any, transferables?: Set<Transferable>) => SerializedObject;
};

type Registry = {
    [_: string]: {
        klass: Klass;
        omit: ReadonlyArray<string>;
    };
};

type RegisterOptions<T> = {
    omit?: ReadonlyArray<keyof T>;
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
export function register<T extends any>(klass: Class<T>, name: string, options: RegisterOptions<T> = {}) {
    assert(name, 'Can\'t register a class without a name.');
    assert(!registry[name], `${name} is already registered.`);
    Object.defineProperty(klass, '_classRegistryKey', {
        value: name,
        writable: false
    });
    registry[name] = {
        klass,
        omit: options.omit || []
    } as unknown as Registry[string];
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

register(Color, 'Color');
register(Error, 'Error');
register(Formatted, 'Formatted');
register(FormattedSection, 'FormattedSection');
register(AJAXError, 'AJAXError');
register(ResolvedImage, 'ResolvedImage');
register(StylePropertyFunction, 'StylePropertyFunction');
register(StyleExpression, 'StyleExpression', {omit: ['_evaluator']});

register(ZoomDependentExpression, 'ZoomDependentExpression');
register(ZoomConstantExpression, 'ZoomConstantExpression');
register(CompoundExpression, 'CompoundExpression', {omit: ['_evaluate']});
for (const name in expressions) {
    if (!registry[(expressions[name] as any)._classRegistryKey]) register(expressions[name], `Expression${name}`);
}

function isArrayBuffer(val: any): boolean {
    return val && typeof ArrayBuffer !== 'undefined' &&
           (val instanceof ArrayBuffer || (val.constructor && val.constructor.name === 'ArrayBuffer'));
}

function isImageBitmap(val: any): boolean {
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
            transferables.add((input as ArrayBuffer));
        }
        return input as any;
    }

    if (ArrayBuffer.isView(input)) {
        const view: ArrayBufferView = (input as any);
        if (transferables) {
            transferables.add(view.buffer);
        }
        return view;
    }

    if (input instanceof ImageData) {
        if (transferables) {
            transferables.add(input.data.buffer);
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
        const properties = {'$name': 'Map'};
        for (const [key, value] of input.entries()) {
            properties[key] = serialize(value);
        }
        return properties;
    }

    if (input instanceof Set) {
        const properties = {'$name': 'Set'};
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
            throw new Error(`can't serialize object of unregistered class ${name}`);
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
                const property = (input as any)[key];
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
        const name = (input as any).$name || 'Object';

        if (name === 'Map') {
            const map = new Map();
            for (const key of Object.keys(input)) {
                if (key === '$name')
                    continue;
                const value = (input as SerializedObject)[key];
                map.set(key, deserialize(value));
            }
            return map;
        }

        if (name === 'Set') {
            const set = new Set();
            for (const key of Object.keys(input)) {
                if (key === '$name')
                    continue;
                const value = (input as SerializedObject)[key];
                set.add(deserialize(value));
            }
            return set;
        }

        const {klass} = registry[name];
        if (!klass) {
            throw new Error(`can't deserialize unregistered class ${name}`);
        }

        // @ts-expect-error - TS2339 - Property 'deserialize' does not exist on type 'Class<any>'.
        if (klass.deserialize) {
            // @ts-expect-error - TS2339 - Property 'deserialize' does not exist on type 'Class<any>'.
            return (klass.deserialize as typeof deserialize)(input);
        }

        const result: {
            [_: string]: any;
        } = Object.create(klass.prototype);

        for (const key of Object.keys(input)) {
            if (key === '$name')
                continue;
            const value = (input as SerializedObject)[key];
            result[key] = deserialize(value);
        }

        return result;
    }

    throw new Error(`can't deserialize object of type ${typeof input}`);
}
