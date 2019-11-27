// @flow

import assert from 'assert';
import type {Cancelable} from '../types/cancelable';

class QueueEntry {
    fn: (callback: () => void) => Cancelable;
    canceled: boolean;
    _cancelable: Cancelable;
    _callback: () => void;
    cancel: () => void;

    constructor(fn: (callback: () => void) => Cancelable) {
        this.fn = fn;
        this.cancel = this.cancel.bind(this);
    }

    run(callback: () => void) {
        assert(!this.canceled);
        this._cancelable = this.fn(() => this.done());
        this._callback = callback;
    }

    done() {
        const callback = this._callback;

        if (callback) {
            delete this._callback;
            callback();
        }
    }

    cancel() {
        this.canceled = true;
        if (this._cancelable) {
            this._cancelable.cancel();
        }
        this.done();
    }
}

export default class ThrottledQueue {
    maxConcurrent: number;
    numCurrent: number;
    queue: Array<QueueEntry>;

    constructor(maxConcurrent: number) {
        this.maxConcurrent = maxConcurrent;
        this.numCurrent = 0;
        this.queue = [];
    }

    add(fn: (callback: () => void) => Cancelable): Cancelable {
        const entry = new QueueEntry(fn);

        if (this.numCurrent < this.maxConcurrent) {
            assert(this.queue.length === 0);
            this._run(entry);
        } else {
            this.queue.push(entry);
        }
        return entry;
    }

    _run(entry: QueueEntry) {
        this.numCurrent++;
        console.log('current', this.numCurrent, this.queue.length);
        entry.run(() => {
            this.numCurrent--;
            assert(this.numCurrent >= 0);
            console.log('current', this.numCurrent, this.queue.length);
            this.advance();
        });
    }

    advance() {
        while (this.queue.length && this.numCurrent < this.maxConcurrent) {
            const entry = this.queue.shift();
            if (!entry.canceled) {
                this._run(entry);
            }
        }
    }

}
