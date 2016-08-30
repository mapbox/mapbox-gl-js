'use strict';

/* eslint-env browser */
var isWorker = typeof window === 'undefined';
module.exports = isWorker ? self : window;
