'use strict';

var jsonlint = require('jsonlint-lines-primitives');
var ParsingError = require('./parsing_error');

module.exports = function parseStyle(string) {
    try {
        return jsonlint.parse(string.toString());
    } catch (e) {
        throw new ParsingError(e);
    }
};
