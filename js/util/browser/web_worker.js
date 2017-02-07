'use strict';

var WebWorkify = require('webworkify');
var window = require('../window');
var workerURL = window.URL.createObjectURL(new WebWorkify(require('../../source/worker'), {bare: true}));

module.exports = function () {
    return new window.Worker(workerURL);
};
