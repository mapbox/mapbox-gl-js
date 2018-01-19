// @flow

const WebWorkify = require('webworkify');
const window = require('../window');
const workerURL = window.URL.createObjectURL(new WebWorkify(require('../../source/worker'), {bare: true}));

import type {WorkerInterface} from '../web_worker';

module.exports = function (): WorkerInterface {
    return (new window.Worker(workerURL): any);
};
