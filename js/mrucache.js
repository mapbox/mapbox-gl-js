/*
 * A [most-recently-used cache](http://en.wikipedia.org/wiki/Cache_algorithms)
 * with hash lookup made possible by keeping a list of keys in parallel to
 * an array of dictionary of values
 */
function MRUCache(length) {
    this.max = length;
    this.list = {};
    this.order = [];
}

/*
 * Add a key, value combination to the cache, trimming its size if this pushes
 * it over max length.
 */
MRUCache.prototype.add = function(key, data) {
    this.list[key] = data;
    this.order.push(key);

    while (this.order.length > this.max) {
        this.get(this.order[0]);
        // do nothing with it and discard/gc
    }
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
    var data = null;
    if (this.has(key)) {
        data = this.list[key];
        delete this.list[key];
    }

    var pos = this.order.indexOf(key);
    if (pos >= 0) {
        this.order.splice(pos, 1);
    }

    return data;
};
