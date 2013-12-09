'use strict';

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


assert.ok = function ok(value, message) {
    if (!value) {
        fail(value, true, message, '==', assert.ok);
    }
};

assert.equal = function equal(actual, expected, message) {
    if (actual != expected) fail(actual, expected, message, '==', assert.equal);
};

}
