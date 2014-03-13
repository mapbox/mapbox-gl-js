'use strict';

module.exports = Point;

function Point(x, y) {
    this.x = x;
    this.y = y;
}

Point.prototype = {
    clone: function() { return new Point(this.x, this.y); },

    add:  function(p) { return this.clone()._add(p); },
    sub:  function(p) { return this.clone()._sub(p); },
    mult: function(k) { return this.clone()._mult(k); },
    div:  function(k) { return this.clone()._div(k); },

    _mult: function(k) {
        this.x *= k;
        this.y *= k;
    },

    _div: function(k) {
        this.x /= k;
        this.y /= k;
    },

    _add: function(p) {
        this.x += p.x;
        this.y += p.y;
    },

    _sub: function(p) {
        this.x -= p.x;
        this.y -= p.y;
    }
};

// constructs Point from an array if necessary
Point.convert = function (a) {
    if (a instanceof Point) {
        return a;
    }
    if (Array.isArray(a)) {
        return new Point(a[0], a[1]);
    }
    return a;
};
