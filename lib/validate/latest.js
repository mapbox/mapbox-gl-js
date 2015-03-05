'use strict';

var reference = require('mapbox-gl-style-spec/reference/latest');
var validate = require('./parsed');

module.exports = function(style) {
    return validate(style, reference);
};
