import {test, expect} from "../../util/vitest.js";
import {register, serialize, deserialize} from '../../../src/util/web_worker_transfer.js';

test('round trip', () => {
    class Foo {
        n;
        buffer;
        _cached;

        constructor(n) {
            this.n = n;
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

    const foo = new Foo(10);
    const transferables = new Set();
    const deserialized = deserialize(serialize(foo, transferables));
    expect(deserialized instanceof Foo).toBeTruthy();
    const bar = deserialized;

    expect(foo !== bar).toBeTruthy();
    expect(bar.constructor === Foo).toBeTruthy();
    expect(bar.n === 10).toBeTruthy();
    expect(bar.buffer === foo.buffer).toBeTruthy();
    expect(transferables.has(foo.buffer)).toBeTruthy();
    expect(bar._cached === undefined).toBeTruthy();
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
            this.id = id;
            this._deserialized = false;
        }

        static serialize(b) {
            return {foo: `custom serialization,${b.id}`};
        }

        static deserialize(input) {
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
