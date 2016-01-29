'use strict';

var validateStyle = require('./validate_style');
var parseStyle = require('./parse_style');
var ParsingError = require('./parsing_error');

module.exports = function validateStyleInferringSpec(style, styleSpec) {
    var index = require('../');
    try {
        style = parseStyle(style);
        return validateStyle(style, styleSpec || index['v' + style.version]);
    } catch (e) {
        if (e instanceof ParsingError) return [e];
        else throw e;
    }
};
