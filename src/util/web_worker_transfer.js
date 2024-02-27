// @flow

import assert from 'assert';

import Grid from 'grid-index';
import Color from '../style-spec/util/color.js';
import {StylePropertyFunction, StyleExpression, ZoomDependentExpression, ZoomConstantExpression} from '../style-spec/expression/index.js';
import CompoundExpression from '../style-spec/expression/compound_expression.js';
import expressions from '../style-spec/expression/definitions/index.js';
import ResolvedImage from '../style-spec/expression/types/resolved_image.js';
import {AJAXError} from './ajax.js';

import type {Transferable} from '../types/transferable.js';
import Formatted, {FormattedSection} from '../style-spec/expression/types/formatted.js';

type SerializedObject = interface { [_: string]: Serialized };
export type Serialized =
    | null
    | void
    | boolean
    | number
    | string
    | Boolean
    | Number
    | String
    | Date
    | RegExp
    | ArrayBuffer
    | $ArrayBufferView
    | ImageData
    | Array<Serialized>
    | SerializedObject;

type Registry = {
    [_: string]: {
        klass: Class<any>,
        omit: $ReadOnlyArray<string>
    }
};

type RegisterOptions<T> = {
    omit?: $ReadOnlyArray<$Keys<T>>
}

const registry: Registry = {};

/**
 * Register the given class as serializable.
 *
 * @param options
 * @param options.omit List of properties to omit from serialization (e.g., cached/computed properties)
 *
 * @private
 */
export function register<T: any>(klass: Class<T>, name: string, options: RegisterOptions<T> = {}) {
    assert(name, 'Can\'t register a class without a name.');
    assert(!registry[name], `${name} is already registered.`);
    Object.defineProperty(klass, '_classRegistryKey', {
        value: name,
        writeable: false
    });
    registry[name] = {
        klass,
        omit: options.omit || []
    };
}

register(Object, 'Object');

type SerializedGrid = { buffer: ArrayBuffer };

(Grid: any).serialize = function serialize(grid: Grid, transferables?: Set<Transferable>): SerializedGrid {
    const buffer = grid.toArrayBuffer();
    if (transferables) {
        transferables.add(buffer);
    }
    return {buffer};
};

(Grid: any).deserialize = function deserialize(serialized: SerializedGrid): Grid {
    return new Grid(serialized.buffer);
};

Object.defineProperty(Grid, 'name', {value: 'Grid'});

register(Grid, 'Grid');

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
    if (!registry[(expressions[name]: any)._classRegistryKey]) register(expressions[name], `Expression${name}`);
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
export function serialize(input: mixed, transferables: ?Set<Transferable>): Serialized {
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
        return input;
    }

    if (isArrayBuffer(input) || isImageBitmap(input)) {
        if (transferables) {
            transferables.add(((input: any): ArrayBuffer));
        }
        return (input: any);
    }

    if (ArrayBuffer.isView(input)) {
        const view: $ArrayBufferView = (input: any);
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

    if (typeof input === 'object') {
        const klass = (input.constructor: any);
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
            (klass.serialize(input, transferables): SerializedObject) : {};

        if (!klass.serialize) {
            for (const key in input) {
                // any cast due to https://github.com/facebook/flow/issues/5393
                if (!(input: any).hasOwnProperty(key)) continue;
                if (registry[name].omit.indexOf(key) >= 0) continue;
                const property = (input: any)[key];
                properties[key] = serialize(property, transferables);
            }
            if (input instanceof Error) {
                properties['message'] = input.message;
            }
        } else {
            // make sure statically serialized object survives transfer of $name property
            assert(!transferables || !transferables.has((properties: any)));
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

export function deserialize(input: Serialized): mixed {
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
        const name = (input: any).$name || 'Object';

        if (name === 'Map') {
            const map = new Map();
            for (const key of Object.keys(input)) {
                // $FlowFixMe[incompatible-type]
                if (key === '$name') continue;
                const value = (input: SerializedObject)[key];
                map.set(key, deserialize(value));
            }
            return map;
        }

        const {klass} = registry[name];
        if (!klass) {
            throw new Error(`can't deserialize unregistered class ${name}`);
        }

        if (klass.deserialize) {
            return (klass.deserialize: typeof deserialize)(input);
        }

        const result: {[_: string]: any} = Object.create(klass.prototype);

        for (const key of Object.keys(input)) {
            // $FlowFixMe[incompatible-type]
            if (key === '$name') continue;
            const value = (input: SerializedObject)[key];
            result[key] = deserialize(value);
        }

        return result;
    }

    throw new Error(`can't deserialize object of type ${typeof input}`);
}
