function MRUCache(length) {
    this.max = length;
    this.list = {};
    this.order = [];
}

MRUCache.prototype.add = function(key, data) {
    this.list[key] = data;
    this.order.push(key);

    while (this.order.length > this.max) {
        this.get(this.order[0]);
        // do nothing with it and discard/gc
    }
};

MRUCache.prototype.has = function(key) {
    return key in this.list;
};

MRUCache.prototype.keys = function() {
    return this.order;
};

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
