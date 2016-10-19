'use strict';

/**
 * A [least-recently-used cache](http://en.wikipedia.org/wiki/Cache_algorithms)
 * with hash lookup made possible by keeping a list of keys in parallel to
 * an array of dictionary of values
 *
 * @private
 */
class LRUCache {
    /**
     * @param {number} max number of permitted values
     * @param {Function} onRemove callback called with items when they expire
     */
    constructor(max, onRemove) {
        this.max = max;
        this.onRemove = onRemove;
        this.reset();
    }

    /**
     * Clear the cache
     *
     * @returns {LRUCache} this cache
     * @private
     */
    reset() {
        for (const key in this.data) {
            this.onRemove(this.data[key]);
        }

        this.data = {};
        this.order = [];

        return this;
    }

    /**
     * Add a key, value combination to the cache, trimming its size if this pushes
     * it over max length.
     *
     * @param {string} key lookup key for the item
     * @param {*} data any value
     *
     * @returns {LRUCache} this cache
     * @private
     */
    add(key, data) {

        if (this.has(key)) {
            this.order.splice(this.order.indexOf(key), 1);
            this.data[key] = data;
            this.order.push(key);

        } else {
            this.data[key] = data;
            this.order.push(key);

            if (this.order.length > this.max) {
                const removedData = this.get(this.order[0]);
                if (removedData) this.onRemove(removedData);
            }
        }

        return this;
    }

    /**
     * Determine whether the value attached to `key` is present
     *
     * @param {string} key the key to be looked-up
     * @returns {boolean} whether the cache has this value
     * @private
     */
    has(key) {
        return key in this.data;
    }

    /**
     * List all keys in the cache
     *
     * @returns {Array<string>} an array of keys in this cache.
     * @private
     */
    keys() {
        return this.order;
    }

    /**
     * Get the value attached to a specific key. If the key is not found,
     * returns `null`
     *
     * @param {string} key the key to look up
     * @returns {*} the data, or null if it isn't found
     * @private
     */
    get(key) {
        if (!this.has(key)) { return null; }

        const data = this.data[key];

        delete this.data[key];
        this.order.splice(this.order.indexOf(key), 1);

        return data;
    }

    /**
     * Change the max size of the cache.
     *
     * @param {number} max the max size of the cache
     * @returns {LRUCache} this cache
     * @private
     */
    setMaxSize(max) {
        this.max = max;

        while (this.order.length > this.max) {
            const removedData = this.get(this.order[0]);
            if (removedData) this.onRemove(removedData);
        }

        return this;
    }
}

module.exports = LRUCache;
