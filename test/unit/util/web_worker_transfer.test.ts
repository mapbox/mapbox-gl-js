// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import {test, expect} from '../../util/vitest';
import {register, serialize, deserialize} from '../../../src/util/web_worker_transfer';
import {AJAXError} from '../../../src/util/ajax';

const roundTrip = (v) => deserialize(serialize(v));

test('round trip', () => {
    class Foo {
        n;
        b;
        buffer;
        _cached;

        constructor(n, b) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            this.n = n;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            this.b = b;
            this.buffer = new ArrayBuffer(100);
            this.squared();
        }

        squared() {
            if (this._cached) {
                return this._cached;
            }
            this._cached = this.n * this.n;
            return this._cached;
        }
    }

    register(Foo, 'Foo', {omit: ['_cached']});

    const foo = new Foo(10, 4895947598347521289105569050n);
    const transferables = new Set();
    const deserialized = deserialize(serialize(foo, transferables));
    expect(deserialized instanceof Foo).toBeTruthy();
    const bar = deserialized;

    expect(foo !== bar).toBeTruthy();
    expect(bar.constructor === Foo).toBeTruthy();
    expect(bar.n === 10).toBeTruthy();
    expect(bar.b === 4895947598347521289105569050n).toBeTruthy();
    expect(bar.buffer === foo.buffer).toBeTruthy();
    expect(transferables.has(foo.buffer)).toBeTruthy();
    expect(bar._cached === undefined).toBeTruthy();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    expect(bar.squared() === 100).toBeTruthy();
});

test('duplicate buffers', () => {
    const foo = new ArrayBuffer(1);
    const transferables = new Set();
    const deserialized = deserialize(serialize([foo, foo], transferables));
    expect(deserialized).toEqual([foo, foo]);
    expect(transferables.size === 1).toBeTruthy();
});

test('custom serialization', () => {
    class Bar {
        id;
        _deserialized;
        constructor(id) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            this.id = id;
            this._deserialized = false;
        }

        static serialize(b) {
            return {foo: `custom serialization,${b.id}`};
        }

        static deserialize(input) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            const b = new Bar(input.foo.split(',')[1]);
            b._deserialized = true;
            return b;
        }
    }

    register(Bar, 'Bar');

    const bar = new Bar('a');
    expect(!bar._deserialized).toBeTruthy();

    const deserialized = deserialize(serialize(bar));
    expect(deserialized instanceof Bar).toBeTruthy();
    const bar2 = deserialized;
    expect(bar2.id).toEqual(bar.id);
    expect(bar2._deserialized).toBeTruthy();
});

test('round-trips Error preserving message, name, and stack', () => {
    const original = new Error('boom');
    original.stack = 'Error: boom\n    at synthetic:1:1';
    const e = roundTrip(original);
    expect(e).toBeInstanceOf(Error);
    expect(e.message).toBe('boom');
    expect(e.name).toBe('Error');
    expect(e.stack).toBe(original.stack);
});

test('round-trips known Error subclass preserving instanceof', () => {
    const e = roundTrip(new TypeError('msg'));
    expect(e).toBeInstanceOf(TypeError);
    expect(e.message).toBe('msg');
    expect(e.name).toBe('TypeError');
});

test('round-trips DOMException preserving name and derived code', () => {
    const abort = roundTrip(new DOMException('aborted', 'AbortError'));
    expect(abort).toBeInstanceOf(DOMException);
    expect(abort.name).toBe('AbortError');
    expect(abort.message).toBe('aborted');

    const bad = roundTrip(new DOMException('bad state', 'InvalidStateError'));
    expect(bad).toBeInstanceOf(DOMException);
    expect(bad.name).toBe('InvalidStateError');
    expect(bad.code).toBe(new DOMException('', 'InvalidStateError').code);
});

test('round-trips AJAXError preserving status and url', () => {
    const original = new AJAXError('Not Found', 404, 'https://example.com/tile');
    const e = roundTrip(original);
    expect(e).toBeInstanceOf(AJAXError);
    expect(e.message).toBe(original.message);
    expect(e.status).toBe(404);
    expect(e.url).toBe('https://example.com/tile');
    expect(e.name).toBe(original.name);
});

test('round-trips AJAXError 401 + Mapbox URL without double-appending token hint', () => {
    const original = new AJAXError('Unauthorized', 401, 'https://api.mapbox.com/v4/tile');
    expect(original.message).toContain('invalid Mapbox access token');
    const e = roundTrip(original);
    expect(e).toBeInstanceOf(AJAXError);
    expect(e.message).toBe(original.message);
});

test('round-trips Error cause recursively', () => {
    const outer = new Error('outer', {cause: new TypeError('inner')});
    const e = roundTrip(outer);
    expect(e.cause).toBeInstanceOf(TypeError);
    expect(e.cause.message).toBe('inner');
});

test('round-trips AggregateError preserving nested error classes', () => {
    const agg = new AggregateError([new Error('a'), new TypeError('b')], 'agg');
    const e = roundTrip(agg);
    expect(e).toBeInstanceOf(AggregateError);
    expect(e.message).toBe('agg');
    expect(e.errors).toHaveLength(2);
    expect(e.errors[0]).toBeInstanceOf(Error);
    expect(e.errors[0].message).toBe('a');
    expect(e.errors[1]).toBeInstanceOf(TypeError);
    expect(e.errors[1].message).toBe('b');
});

test('round-trips unknown Error subclass collapsed to Error with name preserved', () => {
    class MyError extends Error {
        constructor(m) {
            super(m);
            this.name = 'MyError';
        }
    }
    const e = roundTrip(new MyError('custom'));
    expect(e).toBeInstanceOf(Error);
    expect(e).not.toBeInstanceOf(MyError);
    expect(e.name).toBe('MyError');
    expect(e.message).toBe('custom');
});

test('drops self-referential cause and aggregate self-reference instead of overflowing', () => {
    const selfCause = new Error('self') as Error & {cause?: unknown};
    selfCause.cause = selfCause;
    const e = roundTrip(selfCause);
    expect(e.message).toBe('self');
    expect('cause' in e).toBe(false);

    const agg = new AggregateError([new Error('a')], 'agg');
    (agg.errors as unknown[]).push(agg);
    const a = roundTrip(agg);
    expect(a).toBeInstanceOf(AggregateError);
    expect(a.errors).toHaveLength(1);
    expect(a.errors[0].message).toBe('a');
});

test('serialize null-prototype object (e.g. Object.create(null) dictionaries)', () => {
    // ModelManager and the style-spec prototype-pollution fixes store data in
    // Object.create(null) dictionaries. When those flow into worker broadcasts
    // (Style#_updateWorkerModels, etc.), the serializer must not crash trying
    // to read `input.constructor._classRegistryKey` on a null-proto object.
    const dict = Object.create(null) as Record<string, unknown>;
    dict['foo'] = 'https://example.com/model.gltf';
    dict['bar'] = 42;

    const deserialized = deserialize(serialize(dict)) as Record<string, unknown>;
    expect(deserialized.foo).toEqual('https://example.com/model.gltf');
    expect(deserialized.bar).toEqual(42);
});

test('round-trips Headers as a Headers instance with values intact', () => {
    const headers = new Headers();
    headers.set('Cache-Control', 'max-age=300');
    headers.set('Expires', 'Thu, 01 Jan 2099 00:00:00 GMT');

    const result = roundTrip(headers) as Headers;
    expect(result).toBeInstanceOf(Headers);
    expect(result.get('cache-control')).toBe('max-age=300');
    expect(result.get('expires')).toBe('Thu, 01 Jan 2099 00:00:00 GMT');
});
