'use strict';

var jsonlint = require('jsonlint-lines-primitives');
var spec = require('../');
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
 * @returns {Array<Object>} an array of errors
 * @example
 * var fs = require('fs');
 * var validate = require('mapbox-gl-style-spec').validate;
 * var style = fs.readFileSync('./style.json', 'utf8');
 * var errors = validate(style);
 */
module.exports = function(str) {
    var style;

    try {
        style = jsonlint.parse(str.toString());
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

    return validate(style, spec['v' + style.version] || spec.latest);
};

/**
 * Validate a Mapbox GL Style as a JSON object against the given
 * style `reference`. Returns results in the same format as
 * `validate`.
 *
 * @alias validate.parsed
 * @param {Object} style a Mapbox GL Style
 * @returns {Array<Object>} an array of errors
 * @example
 * var fs = require('fs');
 * var validate = require('mapbox-gl-style-spec').validate;
 * var spec = require('mapbox-gl-style-spec');
 * var style = require('./style.json');
 * var errors = validate.parsed(style, spec.v7);
 */
module.exports.parsed = require('./validate/parsed');

/**
 * Validate a Mapbox GL Style given a JSON object against the latest
 * version of the style spec. Returns results in the same format as
 * `validate`.
 *
 * @alias validate.latest
 * @param {Object} style a Mapbox GL Style
 * @returns {Array<Object>} an array of errors
 * @example
 * var fs = require('fs');
 * var validate = require('mapbox-gl-style-spec').validate;
 * var style = require('./style.json');
 * var errors = validate.latest(style);
 */
module.exports.latest = require('./validate/latest');
