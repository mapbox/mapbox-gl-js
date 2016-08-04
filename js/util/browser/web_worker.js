'use strict';
var WebWorkify = require('webworkify');

module.exports = function () {
    return new WebWorkify(require('../../source/worker'));
};
