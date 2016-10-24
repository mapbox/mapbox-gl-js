'use strict';

const UnitBezier = require('unitbezier');
const Coordinate = require('../geo/coordinate');

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
    const t2 = t * t,
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
    const bezier = new UnitBezier(p1x, p1y, p2x, p2y);
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
    const d = max - min;
    const w = ((n - min) % d + d) % d + min;
    return (w === min) ? max : w;
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
    if (!array.length) { return callback(null, []); }
    let remaining = array.length;
    const results = new Array(array.length);
    let error = null;
    array.forEach((item, i) => {
        fn(item, (err, result) => {
            if (err) error = err;
            results[i] = result;
            if (--remaining === 0) callback(error, results);
        });
    });
};

/*
 * Polyfill for Object.values. Not fully spec compliant, but we don't
 * need it to be.
 *
 * @private
 */
exports.values = function (obj) {
    const result = [];
    for (const k in obj) {
        result.push(obj[k]);
    }
    return result;
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
    const difference = [];
    for (const i in obj) {
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
    for (let i = 1; i < arguments.length; i++) {
        const src = arguments[i];
        for (const k in src) {
            dest[k] = src[k];
        }
    }
    return dest;
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
    const result = {};
    for (let i = 0; i < properties.length; i++) {
        const k = properties[i];
        if (k in src) {
            result[k] = src[k];
        }
    }
    return result;
};

let id = 1;

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
    fns.forEach((fn) => {
        if (!context[fn]) { return; }
        context[fn] = context[fn].bind(context);
    });
};

/**
 * Given a list of coordinates, get their center as a coordinate.
 * @param {Array<Coordinate>} coords
 * @returns {Coordinate} centerpoint
 * @private
 */
exports.getCoordinatesCenter = function(coords) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < coords.length; i++) {
        minX = Math.min(minX, coords[i].column);
        minY = Math.min(minY, coords[i].row);
        maxX = Math.max(maxX, coords[i].column);
        maxY = Math.max(maxY, coords[i].row);
    }

    const dx = maxX - minX;
    const dy = maxY - minY;
    const dMax = Math.max(dx, dy);
    return new Coordinate((minX + maxX) / 2, (minY + maxY) / 2, 0)
        .zoomTo(Math.floor(-Math.log(dMax) / Math.LN2));
};

/**
 * Determine if a string ends with a particular substring
 * @param {string} string
 * @param {string} suffix
 * @returns {boolean}
 * @private
 */
exports.endsWith = function(string, suffix) {
    return string.indexOf(suffix, string.length - suffix.length) !== -1;
};

/**
 * Create an object by mapping all the values of an existing object while
 * preserving their keys.
 * @param {Object} input
 * @param {Function} iterator
 * @returns {Object}
 * @private
 */
exports.mapObject = function(input, iterator, context) {
    const output = {};
    for (const key in input) {
        output[key] = iterator.call(context || this, input[key], key, input);
    }
    return output;
};

/**
 * Create an object by filtering out values of an existing object
 * @param {Object} input
 * @param {Function} iterator
 * @returns {Object}
 * @private
 */
exports.filterObject = function(input, iterator, context) {
    const output = {};
    for (const key in input) {
        if (iterator.call(context || this, input[key], key, input)) {
            output[key] = input[key];
        }
    }
    return output;
};

/**
 * Deeply compares two object literals.
 * @param {Object} obj1
 * @param {Object} obj2
 * @returns {boolean}
 * @private
 */
exports.deepEqual = function(a, b) {
    if (Array.isArray(a)) {
        if (!Array.isArray(b) || a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (!exports.deepEqual(a[i], b[i])) return false;
        }
        return true;
    }
    if (typeof a === 'object' && a !== null && b !== null) {
        if (!(typeof b === 'object')) return false;
        const keys = Object.keys(a);
        if (keys.length !== Object.keys(b).length) return false;
        for (const key in a) {
            if (!exports.deepEqual(a[key], b[key])) return false;
        }
        return true;
    }
    return a === b;
};

/**
 * Deeply clones two objects.
 * @param {Object} obj1
 * @param {Object} obj2
 * @returns {boolean}
 * @private
 */
exports.clone = function(input) {
    if (Array.isArray(input)) {
        return input.map(exports.clone);
    } else if (typeof input === 'object') {
        return exports.mapObject(input, exports.clone);
    } else {
        return input;
    }
};

/**
 * Check if two arrays have at least one common element.
 * @param {Array} a
 * @param {Array} b
 * @returns {boolean}
 * @private
 */
exports.arraysIntersect = function(a, b) {
    for (let l = 0; l < a.length; l++) {
        if (b.indexOf(a[l]) >= 0) return true;
    }
    return false;
};

const warnOnceHistory = {};
exports.warnOnce = function(message) {
    if (!warnOnceHistory[message]) {
        // console isn't defined in some WebWorkers, see #2558
        if (typeof console !== "undefined") console.warn(message);
        warnOnceHistory[message] = true;
    }
};

/**
 * Indicates if the provided Points are in a counter clockwise (true) or clockwise (false) order
 *
 * @param {Point} a
 * @param {Point} b
 * @param {Point} c
 *
 * @returns {boolean} true for a counter clockwise set of points
 */
// http://bryceboe.com/2006/10/23/line-segment-intersection-algorithm/
exports.isCounterClockwise = function(a, b, c) {
    return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
};

/**
 * Returns the signed area for the polygon ring.  Postive areas are exterior rings and
 * have a clockwise winding.  Negative areas are interior rings and have a counter clockwise
 * ordering.
 *
 * @param {Array<Point>} ring - Exterior or interior ring
 *
 * @returns {number}
 */
exports.calculateSignedArea = function(ring) {
    let sum = 0;
    for (let i = 0, len = ring.length, j = len - 1, p1, p2; i < len; j = i++) {
        p1 = ring[i];
        p2 = ring[j];
        sum += (p2.x - p1.x) * (p1.y + p2.y);
    }
    return sum;
};

/**
 * Detects closed polygons, first + last point are equal
 * @param {Array<Point>} points array of points
 *
 * @return {boolean} true if the points are a closed polygon
 */
exports.isClosedPolygon = function(points) {
    // If it is 2 points that are the same then it is a point
    // If it is 3 points with start and end the same then it is a line
    if (points.length < 4)
        return false;

    const p1 = points[0];
    const p2 = points[points.length - 1];

    if (Math.abs(p1.x - p2.x) > 0 ||
        Math.abs(p1.y - p2.y) > 0) {
        return false;
    }

    // polygon simplification can produce polygons with zero area and more than 3 points
    return (Math.abs(exports.calculateSignedArea(points)) > 0.01);
};

/**
 * Converts spherical coordinates to cartesian coordinates.
 * @param {Array<number>} spherical Spherical coordinates, in [radial, azimuthal, polar]
 *
 * @return {Array<number>} cartesian coordinates in [x, y, z]
 */

exports.sphericalToCartesian = function(spherical) {
    const r = spherical[0];
    let azimuthal = spherical[1],
        polar = spherical[2];
    // We abstract "north"/"up" (compass-wise) to be 0° when really this is 90° (π/2):
    // correct for that here
    azimuthal += 90;

    // Convert azimuthal and polar angles to radians
    azimuthal *= Math.PI / 180;
    polar *= Math.PI / 180;

    // spherical to cartesian (x, y, z)
    return [
        r * Math.cos(azimuthal) * Math.sin(polar),
        r * Math.sin(azimuthal) * Math.sin(polar),
        r * Math.cos(polar)
    ];
};
