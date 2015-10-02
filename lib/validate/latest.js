'use strict';

var reference = require('../../reference/latest.min.js');
var validate = require('./parsed');

module.exports = function(style) {
    return validate(style, reference);
};
