// @flow

import UnitBezier from '@mapbox/unitbezier';

import Point from '@mapbox/point-geometry';
import window from './window.js';
import assert from 'assert';

import type {Callback} from '../types/callback.js';
import type {Mat4, Vec4} from 'gl-matrix';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/**
 * Converts an angle in degrees to radians
 * copy all properties from the source objects into the destination.
 * The last source object given overrides properties from previous
 * source objects.
 *
 * @param a angle to convert
 * @returns the angle in radians
 * @private
 */
export function degToRad(a: number): number {
    return a * DEG_TO_RAD;
}

/**
 * Converts an angle in radians to degrees
 * copy all properties from the source objects into the destination.
 * The last source object given overrides properties from previous
 * source objects.
 *
 * @param a angle to convert
 * @returns the angle in degrees
 * @private
 */
export function radToDeg(a: number): number {
    return a * RAD_TO_DEG;
}

const TILE_CORNERS = [[0, 0], [1, 0], [1, 1], [0, 1]];

/**
 * Given a particular bearing, returns the corner of the tile thats farthest
 * along the bearing.
 *
 * @param {number} bearing angle in degrees (-180, 180]
 * @returns {QuadCorner}
 * @private
 */
export function furthestTileCorner(bearing: number): [number, number] {
    const alignedBearing = ((bearing + 45) + 360) % 360;
    const cornerIdx = Math.round(alignedBearing / 90) % 4;
    return TILE_CORNERS[cornerIdx];
}

/**
 * @module util
 * @private
 */

/**
 * Given a value `t` that varies between 0 and 1, return
 * an interpolation function that eases between 0 and 1 in a pleasing
 * cubic in-out fashion.
 *
 * @private
 */
export function easeCubicInOut(t: number): number {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const t2 = t * t,
        t3 = t2 * t;
    return 4 * (t < 0.5 ? t3 : 3 * (t - t2) + t3 - 0.75);
}

/**
 * Computes an AABB for a set of points.
 *
 * @param {Point[]} points
 * @returns {{ min: Point, max: Point}}
 * @private
 */
export function getBounds(points: Point[]): { min: Point, max: Point} {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of points) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    }

    return {
        min: new Point(minX, minY),
        max: new Point(maxX, maxY),
    };
}

/**
 * Returns the square of the 2D distance between an AABB defined by min and max and a point.
 * If point is null or undefined, the AABB distance from the origin (0,0) is returned.
 *
 * @param {Array<number>} min The minimum extent of the AABB.
 * @param {Array<number>} max The maximum extent of the AABB.
 * @param {Array<number>} [point] The point to compute the distance from, may be undefined.
 * @returns {number} The square distance from the AABB, 0.0 if the AABB contains the point.
 */
export function getAABBPointSquareDist(min: Array<number>, max: Array<number>, point: ?Array<number>): number {
    let sqDist = 0.0;

    for (let i = 0; i < 2; ++i) {
        const v = point ? point[i] : 0.0;
        assert(min[i] < max[i], 'Invalid aabb min and max inputs, min[i] must be < max[i].');
        if (min[i] > v) sqDist += (min[i] - v) * (min[i] - v);
        if (max[i] < v) sqDist += (v - max[i]) * (v - max[i]);
    }

    return sqDist;
}

/**
 * Converts a AABB into a polygon with clockwise winding order.
 *
 * @param {Point} min The top left point.
 * @param {Point} max The bottom right point.
 * @param {number} [buffer=0] The buffer width.
 * @param {boolean} [close=true] Whether to close the polygon or not.
 * @returns {Point[]} The polygon.
 */
export function polygonizeBounds(min: Point, max: Point, buffer: number = 0, close: boolean = true): Point[] {
    const offset = new Point(buffer, buffer);
    const minBuf = min.sub(offset);
    const maxBuf = max.add(offset);
    const polygon = [minBuf, new Point(maxBuf.x, minBuf.y), maxBuf, new Point(minBuf.x, maxBuf.y)];

    if (close) {
        polygon.push(minBuf.clone());
    }
    return polygon;
}

/**
 * Takes a convex ring and expands it outward by applying a buffer around it.
 * This function assumes that the ring is in clockwise winding order.
 *
 * @param {Point[]} ring The input ring.
 * @param {number} buffer The buffer width.
 * @returns {Point[]} The expanded ring.
 */
export function bufferConvexPolygon(ring: Point[], buffer: number): Point[] {
    assert(ring.length > 2, 'bufferConvexPolygon requires the ring to have atleast 3 points');
    const output = [];
    for (let currIdx = 0; currIdx < ring.length; currIdx++) {
        const prevIdx = wrap(currIdx - 1, -1, ring.length - 1);
        const nextIdx = wrap(currIdx + 1, -1, ring.length - 1);
        const prev = ring[prevIdx];
        const curr = ring[currIdx];
        const next = ring[nextIdx];
        const p1 = prev.sub(curr).unit();
        const p2 = next.sub(curr).unit();
        const interiorAngle = p2.angleWithSep(p1.x, p1.y);
        // Calcuate a vector that points in the direction of the angle bisector between two sides.
        // Scale it based on a right angled triangle constructed at that corner.
        const offset = p1.add(p2).unit().mult(-1 * buffer / Math.sin(interiorAngle / 2));
        output.push(curr.add(offset));
    }
    return output;
}

type EaseFunction = (t: number) => number;

/**
 * Given given (x, y), (x1, y1) control points for a bezier curve,
 * return a function that interpolates along that curve.
 *
 * @param p1x control point 1 x coordinate
 * @param p1y control point 1 y coordinate
 * @param p2x control point 2 x coordinate
 * @param p2y control point 2 y coordinate
 * @private
 */
export function bezier(p1x: number, p1y: number, p2x: number, p2y: number): EaseFunction {
    const bezier = new UnitBezier(p1x, p1y, p2x, p2y);
    return function(t: number) {
        return bezier.solve(t);
    };
}

/**
 * A default bezier-curve powered easing function with
 * control points (0.25, 0.1) and (0.25, 1)
 *
 * @private
 */
export const ease: EaseFunction = bezier(0.25, 0.1, 0.25, 1);

/**
 * constrain n to the given range via min + max
 *
 * @param n value
 * @param min the minimum value to be returned
 * @param max the maximum value to be returned
 * @returns the clamped value
 * @private
 */
export function clamp(n: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, n));
}

/**
 * Equivalent to GLSL smoothstep.
 *
 * @param {number} e0 The lower edge of the sigmoid
 * @param {number} e1 The upper edge of the sigmoid
 * @param {number} x the value to be interpolated
 * @returns {number} in the range [0, 1]
 * @private
 */
export function smoothstep(e0: number, e1: number, x: number): number {
    x = clamp((x - e0) / (e1 - e0), 0, 1);
    return x * x * (3 - 2 * x);
}

/**
 * constrain n to the given range, excluding the minimum, via modular arithmetic
 *
 * @param n value
 * @param min the minimum value to be returned, exclusive
 * @param max the maximum value to be returned, inclusive
 * @returns constrained number
 * @private
 */
export function wrap(n: number, min: number, max: number): number {
    const d = max - min;
    const w = ((n - min) % d + d) % d + min;
    return (w === min) ? max : w;
}

/**
 * Computes shortest angle in range [-180, 180) between two angles.
 *
 * @param {*} a First angle in degrees
 * @param {*} b Second angle in degrees
 * @returns Shortest angle
 * @private
 */
export function shortestAngle(a: number, b: number): number {
    const diff = (b - a + 180) % 360 - 180;
    return diff < -180 ? diff + 360 : diff;
}

/*
 * Call an asynchronous function on an array of arguments,
 * calling `callback` with the completed results of all calls.
 *
 * @param array input to each call of the async function.
 * @param fn an async function with signature (data, callback)
 * @param callback a callback run after all async work is done.
 * called with an array, containing the results of each async call.
 * @private
 */
export function asyncAll<Item, Result>(
    array: Array<Item>,
    fn: (item: Item, fnCallback: Callback<Result>) => void,
    callback: Callback<Array<Result>>
): void {
    if (!array.length) { return callback(null, []); }
    let remaining = array.length;
    const results = new Array(array.length);
    let error = null;
    array.forEach((item, i) => {
        fn(item, (err, result) => {
            if (err) error = err;
            results[i] = ((result: any): Result); // https://github.com/facebook/flow/issues/2123
            if (--remaining === 0) callback(error, results);
        });
    });
}

/*
 * Polyfill for Object.values. Not fully spec compliant, but we don't
 * need it to be.
 *
 * @private
 */
export function values<T>(obj: {[key: string]: T}): Array<T> {
    const result = [];
    for (const k in obj) {
        result.push(obj[k]);
    }
    return result;
}

/*
 * Compute the difference between the keys in one object and the keys
 * in another object.
 *
 * @returns keys difference
 * @private
 */
export function keysDifference<S, T>(obj: {[key: string]: S}, other: {[key: string]: T}): Array<string> {
    const difference = [];
    for (const i in obj) {
        if (!(i in other)) {
            difference.push(i);
        }
    }
    return difference;
}

/**
 * Given a destination object and optionally many source objects,
 * copy all properties from the source objects into the destination.
 * The last source object given overrides properties from previous
 * source objects.
 *
 * @param dest destination object
 * @param sources sources from which properties are pulled
 * @private
 */
export function extend(dest: Object, ...sources: Array<?Object>): Object {
    for (const src of sources) {
        for (const k in src) {
            dest[k] = src[k];
        }
    }
    return dest;
}

/**
 * Given an object and a number of properties as strings, return version
 * of that object with only those properties.
 *
 * @param src the object
 * @param properties an array of property names chosen
 * to appear on the resulting object.
 * @returns object with limited properties.
 * @example
 * var foo = { name: 'Charlie', age: 10 };
 * var justName = pick(foo, ['name']);
 * // justName = { name: 'Charlie' }
 * @private
 */
export function pick(src: Object, properties: Array<string>): Object {
    const result = {};
    for (let i = 0; i < properties.length; i++) {
        const k = properties[i];
        if (k in src) {
            result[k] = src[k];
        }
    }
    return result;
}

let id = 1;

/**
 * Return a unique numeric id, starting at 1 and incrementing with
 * each call.
 *
 * @returns unique numeric id.
 * @private
 */
export function uniqueId(): number {
    return id++;
}

/**
 * Return a random UUID (v4). Taken from: https://gist.github.com/jed/982883
 * @private
 */
export function uuid(): string {
    function b(a) {
        return a ? (a ^ Math.random() * (16 >> a / 4)).toString(16) :
        //$FlowFixMe: Flow doesn't like the implied array literal conversion here
            ([1e7] + -[1e3] + -4e3 + -8e3 + -1e11).replace(/[018]/g, b);
    }
    return b();
}

/**
 * Return whether a given value is a power of two
 * @private
 */
export function isPowerOfTwo(value: number): boolean {
    return (Math.log(value) / Math.LN2) % 1 === 0;
}

/**
 * Return the next power of two, or the input value if already a power of two
 * @private
 */
export function nextPowerOfTwo(value: number): number {
    if (value <= 1) return 1;
    return Math.pow(2, Math.ceil(Math.log(value) / Math.LN2));
}

/**
 * Return the previous power of two, or the input value if already a power of two
 * @private
 */
export function prevPowerOfTwo(value: number): number {
    if (value <= 1) return 1;
    return Math.pow(2, Math.floor(Math.log(value) / Math.LN2));
}

/**
 * Validate a string to match UUID(v4) of the
 * form: xxxxxxxx-xxxx-4xxx-[89ab]xxx-xxxxxxxxxxxx
 * @param str string to validate.
 * @private
 */
export function validateUuid(str: ?string): boolean {
    return str ? /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str) : false;
}

/**
 * Given an array of member function names as strings, replace all of them
 * with bound versions that will always refer to `context` as `this`. This
 * is useful for classes where otherwise event bindings would reassign
 * `this` to the evented object or some other value: this lets you ensure
 * the `this` value always.
 *
 * @param fns list of member function names
 * @param context the context value
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
export function bindAll(fns: Array<string>, context: Object): void {
    fns.forEach((fn) => {
        if (!context[fn]) { return; }
        context[fn] = context[fn].bind(context);
    });
}

/**
 * Determine if a string ends with a particular substring
 *
 * @private
 */
export function endsWith(string: string, suffix: string): boolean {
    return string.indexOf(suffix, string.length - suffix.length) !== -1;
}

/**
 * Create an object by mapping all the values of an existing object while
 * preserving their keys.
 *
 * @private
 */
export function mapObject(input: Object, iterator: Function, context?: Object): Object {
    const output = {};
    for (const key in input) {
        output[key] = iterator.call(context || this, input[key], key, input);
    }
    return output;
}

/**
 * Create an object by filtering out values of an existing object.
 *
 * @private
 */
export function filterObject(input: Object, iterator: Function, context?: Object): Object {
    const output = {};
    for (const key in input) {
        if (iterator.call(context || this, input[key], key, input)) {
            output[key] = input[key];
        }
    }
    return output;
}

import deepEqual from '../style-spec/util/deep_equal.js';
export {deepEqual};

/**
 * Deeply clones two objects.
 *
 * @private
 */
export function clone<T>(input: T): T {
    if (Array.isArray(input)) {
        return ((input.map(clone): any): T);
    } else if (typeof input === 'object' && input) {
        return ((mapObject(input, clone): any): T);
    } else {
        return input;
    }
}

/**
 * Maps a value from a range between [min, max] to the range [outMin, outMax]
 *
 * @private
 */
export function mapValue(value: number, min: number, max: number, outMin: number, outMax: number): number {
    return clamp((value - min) / (max - min) * (outMax - outMin) + outMin, outMin, outMax);
}

/**
 * Check if two arrays have at least one common element.
 *
 * @private
 */
export function arraysIntersect<T>(a: Array<T>, b: Array<T>): boolean {
    for (let l = 0; l < a.length; l++) {
        if (b.indexOf(a[l]) >= 0) return true;
    }
    return false;
}

/**
 * Print a warning message to the console and ensure duplicate warning messages
 * are not printed.
 *
 * @private
 */
const warnOnceHistory: {[key: string]: boolean} = {};

export function warnOnce(message: string): void {
    if (!warnOnceHistory[message]) {
        // console isn't defined in some WebWorkers, see #2558
        if (typeof console !== "undefined") console.warn(message);
        warnOnceHistory[message] = true;
    }
}

/**
 * Indicates if the provided Points are in a counter clockwise (true) or clockwise (false) order
 *
 * @private
 * @returns true for a counter clockwise set of points
 */
// http://bryceboe.com/2006/10/23/line-segment-intersection-algorithm/
export function isCounterClockwise(a: Point, b: Point, c: Point): boolean {
    return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
}

/**
 * Returns the signed area for the polygon ring.  Postive areas are exterior rings and
 * have a clockwise winding.  Negative areas are interior rings and have a counter clockwise
 * ordering.
 *
 * @private
 * @param ring Exterior or interior ring
 */
export function calculateSignedArea(ring: Array<Point>): number {
    let sum = 0;
    for (let i = 0, len = ring.length, j = len - 1, p1, p2; i < len; j = i++) {
        p1 = ring[i];
        p2 = ring[j];
        sum += (p2.x - p1.x) * (p1.y + p2.y);
    }
    return sum;
}

/* global self, WorkerGlobalScope */
/**
 *  Returns true if run in the web-worker context.
 *
 * @private
 * @returns {boolean}
 */
export function isWorker(): boolean {
    return typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined' &&
           self instanceof WorkerGlobalScope;
}

/**
 * Parses data from 'Cache-Control' headers.
 *
 * @private
 * @param cacheControl Value of 'Cache-Control' header
 * @return object containing parsed header info.
 */

export function parseCacheControl(cacheControl: string): Object {
    // Taken from [Wreck](https://github.com/hapijs/wreck)
    const re = /(?:^|(?:\s*\,\s*))([^\x00-\x20\(\)<>@\,;\:\\"\/\[\]\?\=\{\}\x7F]+)(?:\=(?:([^\x00-\x20\(\)<>@\,;\:\\"\/\[\]\?\=\{\}\x7F]+)|(?:\"((?:[^"\\]|\\.)*)\")))?/g;

    const header = {};
    cacheControl.replace(re, ($0, $1, $2, $3) => {
        const value = $2 || $3;
        header[$1] = value ? value.toLowerCase() : true;
        return '';
    });

    if (header['max-age']) {
        const maxAge = parseInt(header['max-age'], 10);
        if (isNaN(maxAge)) delete header['max-age'];
        else header['max-age'] = maxAge;
    }

    return header;
}

let _isSafari = null;

export function _resetSafariCheckForTest() {
    _isSafari = null;
}

/**
 * Returns true when run in WebKit derived browsers.
 * This is used as a workaround for a memory leak in Safari caused by using Transferable objects to
 * transfer data between WebWorkers and the main thread.
 * https://github.com/mapbox/mapbox-gl-js/issues/8771
 *
 * This should be removed once the underlying Safari issue is fixed.
 *
 * @private
 * @param scope {WindowOrWorkerGlobalScope} Since this function is used both on the main thread and WebWorker context,
 *      let the calling scope pass in the global scope object.
 * @returns {boolean}
 */
export function isSafari(scope: any): boolean {
    if (_isSafari == null) {
        const userAgent = scope.navigator ? scope.navigator.userAgent : null;
        _isSafari = !!scope.safari ||
        !!(userAgent && (/\b(iPad|iPhone|iPod)\b/.test(userAgent) || (!!userAgent.match('Safari') && !userAgent.match('Chrome'))));
    }
    return _isSafari;
}

export function isSafariWithAntialiasingBug(scope: any): ?boolean {
    const userAgent = scope.navigator ? scope.navigator.userAgent : null;
    if (!isSafari(scope)) return false;
    // 15.4 is known to be buggy.
    // 15.5 may or may not include the fix. Mark it as buggy to be on the safe side.
    return userAgent && (userAgent.match('Version/15.4') || userAgent.match('Version/15.5') || userAgent.match(/CPU (OS|iPhone OS) (15_4|15_5) like Mac OS X/));
}

export function isFullscreen(): boolean {
    return !!window.document.fullscreenElement || !!window.document.webkitFullscreenElement;
}

export function storageAvailable(type: string): boolean {
    try {
        const storage = window[type];
        storage.setItem('_mapbox_test_', 1);
        storage.removeItem('_mapbox_test_');
        return true;
    } catch (e) {
        return false;
    }
}

// The following methods are from https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/Base64_encoding_and_decoding#The_Unicode_Problem
//Unicode compliant base64 encoder for strings
export function b64EncodeUnicode(str: string): string {
    return window.btoa(
        encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
            (match, p1) => {
                return String.fromCharCode(Number('0x' + p1)); //eslint-disable-line
            }
        )
    );
}

// Unicode compliant decoder for base64-encoded strings
export function b64DecodeUnicode(str: string): string {
    return decodeURIComponent(window.atob(str).split('').map((c) => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); //eslint-disable-line
    }).join(''));
}

export function getColumn(matrix: Mat4, col: number): Vec4 {
    return [matrix[col * 4], matrix[col * 4 + 1], matrix[col * 4 + 2], matrix[col * 4 + 3]];
}

export function setColumn(matrix: Mat4, col: number, values: Vec4) {
    matrix[col * 4 + 0] = values[0];
    matrix[col * 4 + 1] = values[1];
    matrix[col * 4 + 2] = values[2];
    matrix[col * 4 + 3] = values[3];
}
