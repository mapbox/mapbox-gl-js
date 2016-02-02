'use strict';

var validateStyleMin = require('./validate_style.min');
var parseStyle = require('./parse_style');
var ParsingError = require('./parsing_error');

module.exports = function validateStyle(style, styleSpec) {
    var index = require('../');

    try {
        style = parseStyle(style);
    } catch (e) {
        if (e instanceof ParsingError) return [e];
        else throw e;
    }

    styleSpec = styleSpec || index['v' + style.version];

    return validateStyleMin(style, styleSpec);
};
