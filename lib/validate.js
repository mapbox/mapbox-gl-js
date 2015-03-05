'use strict';

var jsonlint = require('jsonlint-lines-primitives');
var validate = require('./validate/parsed');

/**
 * Validate a Mapbox GL Style given as a string of JSON. Returns an array
 * that can contain any number of objects representing errors. Each
 * object has members `line` (number) and `message` (string).
 *
 * This expects the style to be given as a string, rather than an object,
 * so that it can return accurate line numbers for errors.
 * if you happen to have a JSON object already, use validate.parsed() instead.
 *
 * @alias validate
 * @param {string} str a Mapbox GL Style as a string
 * @returns {Array<Object>} an array of error objects
 * @example
 * var fs = require('fs');
 * var validate = require('mapbox-gl-style-lint').validate;
 * var style = fs.readFileSync('./style.json', 'utf8');
 * var errors = validate(style);
 */
module.exports = function(str) {
    try {
        str = jsonlint.parse(str.toString());
    } catch(e) {
        var match = e.message.match(/line (\d+)/),
            lineNumber = 0;
        if (match) lineNumber = parseInt(match[1], 10);
        return [{
            line: lineNumber - 1,
            message: e.message,
            error: e
        }];
    }

    return validate(str);
};
