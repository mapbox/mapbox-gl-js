'use strict';

var validateStyleMin = require('./validate_style.min');
var ParsingError = require('./error/parsing_error');
var jsonlint = require('jsonlint-lines-primitives');

module.exports = function validateStyle(style, styleSpec) {
    var index = require('../');

    if (style instanceof String || typeof style === 'string' || style instanceof Buffer) {
        try {
            style = jsonlint.parse(style.toString());
        } catch (e) {
            return [new ParsingError(e)];
        }
    }

    styleSpec = styleSpec || index['v' + style.version];

    return validateStyleMin(style, styleSpec);
};
