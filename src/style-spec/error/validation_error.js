
const format = require('util').format;

function ValidationError(key, value, ...args) {
    this.message = (key ? `${key}: ` : '') + format.apply(format, args);

    if (value !== null && value !== undefined && value.__line__) {
        this.line = value.__line__;
    }
}

module.exports = ValidationError;
