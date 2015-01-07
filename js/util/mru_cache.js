'use strict';

/*
 * A [most-recently-used cache](http://en.wikipedia.org/wiki/Cache_algorithms)
 * with hash lookup made possible by keeping a list of keys in parallel to
 * an array of dictionary of values
 */
module.exports = MRUCache;
function MRUCache(length, onRemove) {
    this.max = length;
    this.onRemove = onRemove;
    this.reset();
}

/*
 * Clears the cache
 */
MRUCache.prototype.reset = function() {
    for (var key in this.list) {
        this.onRemove(this.list[key]);
    }

    this.list = {};
    this.order = [];

    return this;
};

/*
 * Add a key, value combination to the cache, trimming its size if this pushes
 * it over max length.
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

/*
 * Determine whether the value attached to `key` is present
 */
MRUCache.prototype.has = function(key) {
    return key in this.list;
};

/*
 * List all keys in the cache
 */
MRUCache.prototype.keys = function() {
    return this.order;
};

/*
 * Get the value attached to a specific key. If the key is not found,
 * returns `null`
 */
MRUCache.prototype.get = function(key) {
    if (!this.has(key)) { return null; }

    var data = this.list[key];

    delete this.list[key];
    this.order.splice(this.order.indexOf(key), 1);

    return data;
};
