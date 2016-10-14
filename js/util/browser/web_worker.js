'use strict';

const WebWorkify = require('webworkify');
const window = require('../window');
const workerURL = window.URL.createObjectURL(new WebWorkify(require('../../source/worker'), {bare: true}));

module.exports = function () {
    return new window.Worker(workerURL);
};
