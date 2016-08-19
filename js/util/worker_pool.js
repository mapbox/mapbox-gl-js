'use strict';

var assert = require('assert');
var WebWorker = require('./web_worker');
var browser = require('./browser');

module.exports = WorkerPool;

WorkerPool.WORKER_COUNT = Math.max(browser.hardwareConcurrency - 1, 1);

function WorkerPool() {
    this.workerCount = WorkerPool.WORKER_COUNT;
    this.active = {};
}

WorkerPool.prototype = {
    acquire: function (mapId) {
        if (!this.workers) {
            assert(typeof this.workerCount === 'number');
            this.workers = [];
            while (this.workers.length < this.workerCount) {
                this.workers.push(new WebWorker());
            }
        }

        this.active[mapId] = true;
        return this.workers.slice();
    },

    release: function (mapId) {
        delete this.active[mapId];
        if (Object.keys(this.active).length === 0) {
            this.workers.forEach(function (w) { w.terminate(); });
            this.workers = null;
        }
    }
};

