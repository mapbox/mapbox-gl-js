'use strict';

/**
 * A [most-recently-used cache](http://en.wikipedia.org/wiki/Cache_algorithms)
 * with hash lookup made possible by keeping a list of keys in parallel to
 * an array of dictionary of values
 *
 * @param {number} max number of permitted values
 * @param {Function} onRemove callback called with items when they expire
 * @private
 */
module.exports = MRUCache;
function MRUCache(max, onRemove) {
    this.max = max;
    this.onRemove = onRemove;
    this.reset();
}

/**
 * Clear the cache
 *
 * @returns {MRUCache} this cache
 * @private
 */
MRUCache.prototype.reset = function() {
    for (var key in this.list) {
        this.onRemove(this.list[key]);
    }

    this.list = {};
    this.order = [];

    return this;
};

/**
 * Add a key, value combination to the cache, trimming its size if this pushes
 * it over max length.
 *
 * @param {string} key lookup key for the item
 * @param {*} data any value
 *
 * @returns {MRUCache} this cache
 * @private
 */
MRUCache.prototype.add = function(key, data) {
    this.list[key] = data;
    this.order.push(key);

    if (this.order.length > this.max) {
        var removedData = this.get(this.order[0]);
        if (removedData) this.onRemove(removedData);
    }

    return this;
};

/**
 * Determine whether the value attached to `key` is present
 *
 * @param {string} key the key to be looked-up
 * @returns {boolean} whether the cache has this value
 * @private
 */
MRUCache.prototype.has = function(key) {
    return key in this.list;
};

/**
 * List all keys in the cache
 *
 * @returns {Array<string>} an array of keys in this cache.
 * @private
 */
MRUCache.prototype.keys = function() {
    return this.order;
};

/**
 * Get the value attached to a specific key. If the key is not found,
 * returns `null`
 *
 * @param {string} key the key to look up
 * @returns {*} the data, or null if it isn't found
 * @private
 */
MRUCache.prototype.get = function(key) {
    if (!this.has(key)) { return null; }

    var data = this.list[key];

    delete this.list[key];
    this.order.splice(this.order.indexOf(key), 1);

    return data;
};

/**
 * Change the max size of the cache.
 *
 * @param {number} max the max size of the cache
 * @returns {MRUCache} this cache
 * @private
 */
MRUCache.prototype.setMaxSize = function(max) {
    this.max = max;

    while (this.order.length > this.max) {
        var removedData = this.get(this.order[0]);
        if (removedData) this.onRemove(removedData);
    }

    return this;
};
