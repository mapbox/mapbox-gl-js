// @flow

import type {Value} from './value';

class State<T> {
    value: Value<T>;
    current: T;
    dirty: boolean;

    constructor(v: Value<T>) {
        this.value = v;
        this.current = v.constructor.default(v.context);
    }

    get(): T {
        return this.current;
    }

    set(t: T) {
        if (!this.value.constructor.equal(this.current, t)) {
            this.current = t;
            this.value.set(t);
        }
    }
}

module.exports = State;
