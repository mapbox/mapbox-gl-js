'use strict';

// This is a bare bones copy of node.js' assert.js
//
// THIS IS NOT TESTED NOR LIKELY TO WORK OUTSIDE V8!
//
// Originally from narwhal.js (http://narwhaljs.org)
// Copyright (c) 2009 Thomas Robinson <280north.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the 'Software'), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

if (typeof DEBUG !== 'undefined' && DEBUG) {

var assert = exports;

assert.AssertionError = function AssertionError(options) {
    Error.call(this);
    this.name = 'AssertionError';
    this.actual = options.actual;
    this.expected = options.expected;
    this.operator = options.operator;
    this.message = options.message;
    if (Error.captureStackTrace) {
        Error.captureStackTrace(this, options.stackStartFunction || fail);
    }
};

assert.AssertionError.prototype = Object.create(Error.prototype);

var fail = function(actual, expected, message, operator, stackStartFunction) {
    throw new assert.AssertionError({
        message: message,
        actual: actual,
        expected: expected,
        operator: operator,
        stackStartFunction: stackStartFunction
    });
};

assert.fail = function(message) {
    fail(false, true, message, '==', assert.fail);
};

assert.ok = function(value, message) {
    if (!value) {
        fail(value, true, message, '==', assert.ok);
    }
};

assert.equal = function(actual, expected, message) {
    if (actual != expected) fail(actual, expected, message, '==', assert.equal);
};

} else {
    module.exports = undefined;
}
