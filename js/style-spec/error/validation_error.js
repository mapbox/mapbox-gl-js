'use strict';

const format = require('util').format;

function ValidationError(key, value /*, message, ...*/) {
    this.message = (
        (key ? `${key}: ` : '') +
        format.apply(format, Array.prototype.slice.call(arguments, 2))
    );

    if (value !== null && value !== undefined && value.__line__) {
        this.line = value.__line__;
    }
}

module.exports = ValidationError;
