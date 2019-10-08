// @flow
export class CircularBuffer<T> {
    _arr: Array<?T>;
    _capacity: number;
    _end: number;
    _count: number;
    _evictcb: Function;

    /**
     * An implementation of a circular buffer, with wraparound indexing for implementing object pools.
     * @param {number} [capacity=50]
     * @param {(elem: T) => void} evictcb
     * @private
     */
    constructor(capacity: number = 50, evictcb: (elem: T) => void) {
        this._arr = new Array(capacity);
        this._capacity = capacity;
        this._end = 0;
        this._count = 0;
        this._evictcb = evictcb;
    }

    /**
     * Adds an element to the buffer
     *
     * @param {T} elem
     * @returns {CircularBuffer<T>}
     * @private
     */
    push(elem: T): CircularBuffer<T> {
        this._end = (this._end + 1) % this._capacity;
        const curr = this._arr[this._end];
        if (curr) {
            this._evictcb(curr);
            this._count--;
        }

        this._arr[this._end] = elem;
        this._count++;
        return this;
    }

    /**
     * Removes the last added element from the buffer.
     * Returns null if the buffer is empty.
     *
     * @returns {?T}
     * @private
     */
    pop(): ?T {
        if (this._count > 0) {
            const top = this._arr[this._end];
            this._arr[this._end] = null;
            this._end = (this._end + this._capacity - 1) % this._capacity;
            this._count--;
            return top;
        } else {
            return null;
        }
    }

    /**
     * Retuns the number of lelements currently in the buffer
     *
     * @readonly
     * @type {number}
     * @private
     */
    get count(): number {
        return this._count;
    }
}
