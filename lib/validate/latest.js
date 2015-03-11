'use strict';

var reference = require('../../reference/latest.js');
var validate = require('./parsed');

module.exports = function(style) {
    return validate(style, reference);
};
