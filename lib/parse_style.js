'use strict';

var jsonlint = require('jsonlint-lines-primitives');
var ParsingError = require('./error/parsing_error');

module.exports = function parseStyle(style) {
    if (style instanceof String || typeof style === 'string' || style instanceof Buffer) {
        try {
            return jsonlint.parse(style.toString());
        } catch (e) {
            throw new ParsingError(e);
        }
    } else {
        return style;
    }
};
