'use strict';

var UnitBezier = require('unitbezier');
var Coordinate = require('../geo/coordinate');

/**
 * Given a value `t` that varies between 0 and 1, return
 * an interpolation function that eases between 0 and 1 in a pleasing
 * cubic in-out fashion.
 *
 * @param {number} t input
 * @returns {number} input
 * @private
 */
exports.easeCubicInOut = function (t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    var t2 = t * t,
        t3 = t2 * t;
    return 4 * (t < 0.5 ? t3 : 3 * (t - t2) + t3 - 0.75);
};

/**
 * Given given (x, y), (x1, y1) control points for a bezier curve,
 * return a function that interpolates along that curve.
 *
 * @param {number} p1x control point 1 x coordinate
 * @param {number} p1y control point 1 y coordinate
 * @param {number} p2x control point 2 x coordinate
 * @param {number} p2y control point 2 y coordinate
 * @returns {Function} interpolator: receives number value, returns
 * number value.
 * @private
 */
exports.bezier = function(p1x, p1y, p2x, p2y) {
    var bezier = new UnitBezier(p1x, p1y, p2x, p2y);
    return function(t) {
        return bezier.solve(t);
    };
};

/**
 * A default bezier-curve powered easing function with
 * control points (0.25, 0.1) and (0.25, 1)
 *
 * @param {number} t
 * @returns {number} output
 * @private
 */
exports.ease = exports.bezier(0.25, 0.1, 0.25, 1);

/**
 * Given a four-element array of numbers that represents a color in
 * RGBA, return a version for which the RGB components are multiplied
 * by the A (alpha) component
 *
 * @param {Array<number>} c color array
 * @returns {Array<number>} premultiplied color array
 * @private
 */
exports.premultiply = function (c) {
    c[0] *= c[3];
    c[1] *= c[3];
    c[2] *= c[3];
    return c;
};

/**
 * constrain n to the given range via min + max
 *
 * @param {number} n value
 * @param {number} min the minimum value to be returned
 * @param {number} max the maximum value to be returned
 * @returns {number} the clamped value
 * @private
 */
exports.clamp = function (n, min, max) {
    return Math.min(max, Math.max(min, n));
};

/*
 * constrain n to the given range, excluding the minimum, via modular arithmetic
 * @param {number} n value
 * @param {number} min the minimum value to be returned, exclusive
 * @param {number} max the maximum value to be returned, inclusive
 * @returns {number} constrained number
 * @private
 */
exports.wrap = function (n, min, max) {
    var d = max - min;
    var w = ((n - min) % d + d) % d + min;
    return (w === min) ? max : w;
};

/*
 * return the first non-null and non-undefined argument to this function.
 * @returns {*} argument
 * @private
 */
exports.coalesce = function() {
    for (var i = 0; i < arguments.length; i++) {
        var arg = arguments[i];
        if (arg !== null && arg !== undefined)
            return arg;
    }
};

/*
 * Call an asynchronous function on an array of arguments,
 * calling `callback` once all calls complete.
 *
 * @param {Array<*>} array input to each call of the async function.
 * @param {Function} fn an async function with signature (data, callback)
 * @param {Function} callback a callback run after all async work is done.
 * called with no arguments
 * @returns {undefined}
 * @private
 */
exports.asyncEach = function (array, fn, callback) {
    var remaining = array.length;
    if (remaining === 0) return callback();
    function check() { if (--remaining === 0) callback(); }
    for (var i = 0; i < array.length; i++) fn(array[i], check);
};

/*
 * Call an asynchronous function on an array of arguments,
 * calling `callback` with the completed results of all calls.
 *
 * @param {Array<*>} array input to each call of the async function.
 * @param {Function} fn an async function with signature (data, callback)
 * @param {Function} callback a callback run after all async work is done.
 * called with an array, containing the results of each async call.
 * @returns {undefined}
 * @private
 */
exports.asyncAll = function (array, fn, callback) {
    var remaining = array.length;
    var results = new Array(array.length);
    var error = null;
    array.forEach(function (item, i) {
        fn(item, function (err, result) {
            if (err) error = err;
            results[i] = result;
            if (--remaining === 0) callback(error, results);
        });
    });
};

/*
 * Compute the difference between the keys in one object and the keys
 * in another object.
 *
 * @param {Object} obj
 * @param {Object} other
 * @returns {Array<string>} keys difference
 * @private
 */
exports.keysDifference = function (obj, other) {
    var difference = [];
    for (var i in obj) {
        if (!(i in other)) {
            difference.push(i);
        }
    }
    return difference;
};

/**
 * Given a destination object and optionally many source objects,
 * copy all properties from the source objects into the destination.
 * The last source object given overrides properties from previous
 * source objects.
 * @param {Object} dest destination object
 * @param {...Object} sources sources from which properties are pulled
 * @returns {Object} dest
 * @private
 */
exports.extend = function (dest) {
    for (var i = 1; i < arguments.length; i++) {
        var src = arguments[i];
        for (var k in src) {
            dest[k] = src[k];
        }
    }
    return dest;
};

/**
 * Extend a destination object with all properties of the src object,
 * using defineProperty instead of simple assignment.
 * @param {Object} dest
 * @param {Object} src
 * @returns {Object} dest
 * @private
 */
exports.extendAll = function (dest, src) {
    for (var i in src) {
        Object.defineProperty(dest, i, Object.getOwnPropertyDescriptor(src, i));
    }
    return dest;
};

/**
 * Extend a parent's prototype with all properties in a properties
 * object.
 *
 * @param {Object} parent
 * @param {Object} props
 * @returns {Object}
 * @private
 */
exports.inherit = function (parent, props) {
    var parentProto = typeof parent === 'function' ? parent.prototype : parent,
        proto = Object.create(parentProto);
    exports.extendAll(proto, props);
    return proto;
};

/**
 * Given an object and a number of properties as strings, return version
 * of that object with only those properties.
 *
 * @param {Object} src the object
 * @param {Array<string>} properties an array of property names chosen
 * to appear on the resulting object.
 * @returns {Object} object with limited properties.
 * @example
 * var foo = { name: 'Charlie', age: 10 };
 * var justName = pick(foo, ['name']);
 * // justName = { name: 'Charlie' }
 * @private
 */
exports.pick = function (src, properties) {
    var result = {};
    for (var i = 0; i < properties.length; i++) {
        var k = properties[i];
        if (k in src) {
            result[k] = src[k];
        }
    }
    return result;
};

var id = 1;

/**
 * Return a unique numeric id, starting at 1 and incrementing with
 * each call.
 *
 * @returns {number} unique numeric id.
 * @private
 */
exports.uniqueId = function () {
    return id++;
};

/**
 * Create a version of `fn` that only fires once every `time` millseconds.
 *
 * @param {Function} fn the function to be throttled
 * @param {number} time millseconds required between function calls
 * @param {*} context the value of `this` with which the function is called
 * @returns {Function} debounced function
 * @private
 */
exports.throttle = function (fn, time, context) {
    var lock, args, wrapperFn, later;

    later = function () {
        // reset lock and call if queued
        lock = false;
        if (args) {
            wrapperFn.apply(context, args);
            args = false;
        }
    };

    wrapperFn = function () {
        if (lock) {
            // called too soon, queue to call later
            args = arguments;

        } else {
            // call and lock until later
            fn.apply(context, arguments);
            setTimeout(later, time);
            lock = true;
        }
    };

    return wrapperFn;
};

/**
 * Create a version of `fn` that is only called `time` milliseconds
 * after its last invocation
 *
 * @param {Function} fn the function to be debounced
 * @param {number} time millseconds after which the function will be invoked
 * @returns {Function} debounced function
 * @private
 */
exports.debounce = function(fn, time) {
    var timer, args;

    return function() {
        args = arguments;
        clearTimeout(timer);

        timer = setTimeout(function() {
            fn.apply(null, args);
        }, time);
    };
};

/**
 * Given an array of member function names as strings, replace all of them
 * with bound versions that will always refer to `context` as `this`. This
 * is useful for classes where otherwise event bindings would reassign
 * `this` to the evented object or some other value: this lets you ensure
 * the `this` value always.
 *
 * @param {Array<string>} fns list of member function names
 * @param {*} context the context value
 * @returns {undefined} changes functions in-place
 * @example
 * function MyClass() {
 *   bindAll(['ontimer'], this);
 *   this.name = 'Tom';
 * }
 * MyClass.prototype.ontimer = function() {
 *   alert(this.name);
 * };
 * var myClass = new MyClass();
 * setTimeout(myClass.ontimer, 100);
 * @private
 */
exports.bindAll = function(fns, context) {
    fns.forEach(function(fn) {
        context[fn] = context[fn].bind(context);
    });
};

/**
 * Given a class, bind all of the methods that look like handlers: that
 * begin with _on, and bind them to the class.
 *
 * @param {Object} context an object with methods
 * @private
 */
exports.bindHandlers = function(context) {
    for (var i in context) {
        if (typeof context[i] === 'function' && i.indexOf('_on') === 0) {
            context[i] = context[i].bind(context);
        }
    }
};

/**
 * Set the 'options' property on `obj` with properties
 * from the `options` argument. Properties in the `options`
 * object will override existing properties.
 *
 * @param {Object} obj destination object
 * @param {Object} options object of override options
 * @returns {Object} derived options object.
 * @private
 */
exports.setOptions = function(obj, options) {
    if (!obj.hasOwnProperty('options')) {
        obj.options = obj.options ? Object.create(obj.options) : {};
    }
    for (var i in options) {
        obj.options[i] = options[i];
    }
    return obj.options;
};

/**
 * Given a list of coordinates, get their center as a coordinate.
 * @param {Array<Coordinate>} coords
 * @returns {Coordinate} centerpoint
 * @private
 */
exports.getCoordinatesCenter = function(coords) {
    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;

    for (var i = 0; i < coords.length; i++) {
        minX = Math.min(minX, coords[i].column);
        minY = Math.min(minY, coords[i].row);
        maxX = Math.max(maxX, coords[i].column);
        maxY = Math.max(maxY, coords[i].row);
    }

    var dx = maxX - minX;
    var dy = maxY - minY;
    var dMax = Math.max(dx, dy);
    return new Coordinate((minX + maxX) / 2, (minY + maxY) / 2, 0)
        .zoomTo(Math.floor(-Math.log(dMax) / Math.LN2));
};
